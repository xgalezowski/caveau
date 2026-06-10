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

  // Appellation connue. Priorité : géographie > cépage (indices « faibles »),
  // puis la plus longue qui matche (« pouilly-fumé » vs « pouilly »).
  const FAIBLES = new Set(['riesling', 'gewurztraminer', 'pinot gris', 'pinot blanc', 'sylvaner',
    'nebbiolo', 'saperavi', 'rkatsiteli', 'albariño', 'assyrtiko', 'xinomavro', 'moschofilero', 'agiorgitiko', 'mondeuse']);
  let meilleure = null;
  for (const [app, info] of Object.entries(APPELLATIONS)) {
    const appN = norm(app).replace(/-/g, '[ -]');
    if (new RegExp(`\\b${appN}\\b`).test(resteN.replace(/-/g, ' ').replace(/\s+/g, ' ')) ||
        new RegExp(`\\b${norm(app)}\\b`).test(resteN)) {
      const force = FAIBLES.has(app) ? 0 : 1;
      const forceM = meilleure ? (FAIBLES.has(meilleure.app) ? 0 : 1) : -1;
      if (!meilleure || force > forceM || (force === forceM && app.length > meilleure.app.length)) {
        meilleure = { app, info };
      }
    }
  }
  if (meilleure) {
    b.appellation = meilleure.app.replace(/(^|[\s-])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase());
    b.region = meilleure.info.r;
    if (!b.couleur && meilleure.info.c) b.couleur = meilleure.info.c;
    if (meilleure.info.p) b.pays = meilleure.info.p;
  }

  // Région citée directement (« bourgogne », « bordeaux »…)
  if (!b.region) {
    for (const r of REGIONS) {
      if (new RegExp(`\\b${norm(r).replace(/-/g, '[ -]')}\\b`).test(resteN)) { b.region = r; break; }
    }
  }

  if (!b.couleur) b.couleur = 'rouge'; // défaut statistique d'une cave française
  if (!b.region) b.region = 'Monde';
  b.pays = b.pays || paysParDefaut(b.region);

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

/* ═══ Spiritueux ═══ */

const MOTS_SPIRIT = {
  whisky: 'Whisky', whiskey: 'Whisky', scotch: 'Whisky', bourbon: 'Whisky', 'single malt': 'Whisky',
  rhum: 'Rhum', rum: 'Rhum', gin: 'Gin', cognac: 'Cognac', armagnac: 'Armagnac',
  calvados: 'Calvados', 'eau-de-vie': 'Eau-de-vie', 'eau de vie': 'Eau-de-vie',
  vodka: 'Vodka', tequila: 'Tequila / Mezcal', mezcal: 'Tequila / Mezcal',
  liqueur: 'Liqueur', chartreuse: 'Liqueur', pastis: 'Liqueur',
};
const PAYS_SPIRIT = {
  'Whisky': 'Écosse', 'Cognac': 'France', 'Armagnac': 'France', 'Calvados': 'France',
  'Eau-de-vie': 'France', 'Liqueur': 'France', 'Tequila / Mezcal': 'Mexique',
};

// Parse UNE ligne décrivant un spiritueux. Jamais bloquant.
export function parseLigneSpirit(ligne) {
  let reste = ` ${ligne} `;
  const b = { categorie: 'spiritueux', qty: 1, type: null, age: null, alcool: null, prix: null, pays: null };

  const qtyM = reste.match(/(?:^|\s)(\d{1,2})\s*(?:x\s|bouteilles?|btl?s?\b|flacons?)/i) || reste.match(/(?:^|\s)x\s?(\d{1,2})\b/i);
  if (qtyM) { b.qty = parseInt(qtyM[1], 10); reste = reste.replace(qtyM[0], ' '); }

  const prixM = reste.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/i) || reste.match(/€\s*(\d+(?:[.,]\d{1,2})?)/);
  if (prixM) { b.prix = parseFloat(prixM[1].replace(',', '.')); reste = reste.replace(prixM[0], ' '); }

  // Degré : « 54% », « 54°», « 54,2 % vol » — avant l'âge pour ne pas confondre
  const degM = reste.match(/(\d{2}(?:[.,]\d)?)\s*(?:%|°|degres|degrés)/i);
  if (degM) { b.alcool = parseFloat(degM[1].replace(',', '.')); reste = reste.replace(degM[0], ' '); }

  // Âge : « 12 ans », « 12 ans d'âge »
  const ageM = reste.match(/(\d{1,2})\s*ans?\b/i);
  if (ageM) { b.age = parseInt(ageM[1], 10); reste = reste.replace(ageM[0], ' '); }

  // Type
  const resteN = norm(reste);
  for (const [mot, type] of Object.entries(MOTS_SPIRIT)) {
    if (new RegExp(`\\b${norm(mot).replace(/-/g, '[ -]')}\\b`).test(resteN)) {
      b.type = type;
      reste = reste.replace(new RegExp(mot.replace(/-/g, '[ -]'), 'i'), ' ');
      break;
    }
  }
  if (!b.type) b.type = 'Autre';
  b.pays = PAYS_SPIRIT[b.type] || null;

  // Marque = premier mot restant, nom/expression = la suite
  const mots = reste
    .replace(/[,;]/g, ' ')
    .replace(/(^|\s)(bouteilles?|btl?s?|flacons?|de|du|des|le|la|les|une?|et|à|a|en|d)(?=\s|$)/gi, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (m, p, c) => p + c.toUpperCase())
    .split(' ').filter(Boolean);
  b.domaine = mots[0] || '';
  b.nom = mots.slice(1).join(' ') || (b.age ? `${b.age} ans` : b.type);
  return b;
}

export function parseTexteSpirit(texte) {
  return decoupe(texte).map(parseLigneSpirit);
}
