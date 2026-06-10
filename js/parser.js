// Parsing de texte libre (saisie ou dictée) → bouteilles structurées.
// « 3 bouteilles de Gevrey-Chambertin 2019 domaine Dugat, 65€ » → objet bouteille.
// Module pur, testable sous Node.

import { APPELLATIONS, REGIONS, gardeParDefaut, paysParDefaut } from './wine-data.js';

const COULEUR_MOTS = {
  rouge: 'rouge', blanc: 'blanc', 'rosé': 'rosé', rose: 'rosé',
  champagne: 'effervescent', bulles: 'effervescent', 'pétillant': 'effervescent',
  'crémant': 'effervescent', moelleux: 'moelleux', liquoreux: 'moelleux',
};

function norm(s) {
  // NFD ne décompose pas les ligatures (œ, æ) : on les traite à part.
  return s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Découpe une saisie multi-bouteilles : lignes, points-virgules, « et » entre items.
export function decoupe(texte) {
  return texte
    .split(/\n|;|(?:^|\s)•\s?/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

// Parse UNE ligne décrivant une bouteille. Renvoie toujours un objet (jamais bloquant).
export function parseLigne(ligne) {
  let reste = ` ${ligne} `;
  const b = { qty: 1, couleur: null, region: null, appellation: null, millesime: null, prix: null };

  // Quantité : « 3 bouteilles », « x6 », « 2 btl »
  const qtyM = reste.match(/(?:^|\s)(\d{1,2})\s*(?:x\s|bouteilles?|btl?s?\b|flacons?)/i) || reste.match(/(?:^|\s)x\s?(\d{1,2})\b/i);
  if (qtyM) { b.qty = parseInt(qtyM[1], 10); reste = reste.replace(qtyM[0], ' '); }

  // Prix : « 45€ », « 45 euros », « €45 »
  const prixM = reste.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/i) || reste.match(/€\s*(\d+(?:[.,]\d{1,2})?)/);
  if (prixM) { b.prix = parseFloat(prixM[1].replace(',', '.')); reste = reste.replace(prixM[0], ' '); }

  // Millésime : 1950–2049, en évitant de re-matcher le prix déjà retiré
  const milM = reste.match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  if (milM) { b.millesime = parseInt(milM[1], 10); reste = reste.replace(milM[0], ' '); }

  // Couleur explicite
  const resteN = norm(reste);
  for (const [mot, c] of Object.entries(COULEUR_MOTS)) {
    if (new RegExp(`\\b${norm(mot)}\\b`).test(resteN)) { b.couleur = c; break; }
  }

  // Appellation connue (la plus longue qui matche, pour « pouilly-fumé » vs « pouilly »)
  let meilleure = null;
  for (const [app, info] of Object.entries(APPELLATIONS)) {
    const appN = norm(app).replace(/-/g, '[ -]');
    if (new RegExp(`\\b${appN}\\b`).test(resteN.replace(/-/g, ' ').replace(/\s+/g, ' ')) ||
        new RegExp(`\\b${norm(app)}\\b`).test(resteN)) {
      if (!meilleure || app.length > meilleure.app.length) meilleure = { app, info };
    }
  }
  if (meilleure) {
    b.appellation = meilleure.app.replace(/(^|[\s-])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
    b.region = meilleure.info.r;
    if (!b.couleur) b.couleur = meilleure.info.c;
  }

  // Région citée directement (« bourgogne », « bordeaux »…)
  if (!b.region) {
    for (const r of REGIONS) {
      if (new RegExp(`\\b${norm(r).replace(/-/g, '[ -]')}\\b`).test(resteN)) { b.region = r; break; }
    }
  }

  if (!b.couleur) b.couleur = 'rouge'; // défaut statistique d'une cave française
  if (!b.region) b.region = 'Monde';
  b.pays = paysParDefaut(b.region);

  // Nom : ce qui reste, nettoyé des mots outils
  // Mots-outils retirés seulement s'ils sont entourés d'espaces (pas dans
  // les noms composés type « Châteauneuf-du-Pape »).
  b.nom = reste
    .replace(/[,;]/g, ' ')
    .replace(/(^|\s)(bouteilles?|btl?s?|flacons?|de|du|des|le|la|les|une?|et|à|a|en)(?=\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!b.nom) b.nom = b.appellation || 'Vin sans nom';
  // Capitalisation douce (pas de \b : il casse sur les lettres accentuées)
  b.nom = b.nom.replace(/(^|[\s-])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());

  // Domaine / Château si présent dans le nom
  const domM = ligne.match(/((?:domaine|château|chateau|clos|mas|maison)\s+[A-Za-zÀ-ÿ' -]+?)(?:\s+\d|,|$)/i);
  if (domM) b.domaine = domM[1].trim();

  const g = gardeParDefaut(b.region, b.couleur, b.millesime);
  b.gardeDe = g.gardeDe;
  b.gardeA = g.gardeA;
  return b;
}

export function parseTexte(texte) {
  return decoupe(texte).map(parseLigne);
}
