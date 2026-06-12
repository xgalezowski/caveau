// Moteur d'accords mets-vins : analyse un repas en texte libre, score chaque
// bouteille de la cave (accord, maturité, prix vs occasion) et argumente.
// Module pur, testable sous Node.

import { corpsDe, maturite, caractereDe } from './wine-data.js';
import { t } from './i18n.js';

function norm(s) {
  // NFD ne décompose pas les ligatures (œ, æ) : on les traite à part.
  return s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Profils de plats : mots-clés → cible { couleurs pondérées, corps idéal, régions bonus, note }
const PLATS = [
  { k: ['boeuf', 'entrecote', 'cote de boeuf', 'steak', 'filet de boeuf', 'tartare', 'bavette', 'onglet'],
    cible: { rouge: 3 }, corps: 3, regions: ['Bordeaux', 'Rhône Nord', 'Sud-Ouest'], plat: 'viande rouge' },
  { k: ['agneau', 'gigot', 'souris'],
    cible: { rouge: 3 }, corps: 3, regions: ['Bordeaux', 'Rhône Sud'], plat: 'agneau' },
  { k: ['gibier', 'chevreuil', 'sanglier', 'biche', 'lievre', 'civet'],
    cible: { rouge: 3 }, corps: 3, regions: ['Rhône Nord', 'Bourgogne', 'Sud-Ouest'], plat: 'gibier' },
  { k: ['canard', 'magret', 'confit'],
    cible: { rouge: 3 }, corps: 2, regions: ['Sud-Ouest', 'Bourgogne'], plat: 'canard' },
  { k: ['poulet', 'volaille', 'chapon', 'dinde', 'pintade', 'roti de porc', 'porc', 'veau', 'blanquette'],
    cible: { rouge: 2, blanc: 2 }, corps: 2, regions: ['Bourgogne', 'Loire'], plat: 'viande blanche' },
  { k: ['charcuterie', 'saucisson', 'jambon', 'pate', 'terrine', 'rillettes', 'planche'],
    cible: { rouge: 2, 'rosé': 1 }, corps: 1, regions: ['Beaujolais', 'Loire', 'Rhône Sud'], plat: 'charcuterie' },
  { k: ['champignon', 'cepe', 'morille', 'truffe', 'risotto aux champignons'],
    cible: { rouge: 3, blanc: 1 }, corps: 2, regions: ['Bourgogne', 'Rhône Nord', 'Jura'], plat: 'champignons / truffe' },
  { k: ['saumon', 'thon', 'rouget', 'poisson grille'],
    cible: { blanc: 3, 'rosé': 1, rouge: 1 }, corps: 2, regions: ['Bourgogne', 'Provence', 'Loire'], plat: 'poisson noble' },
  { k: ['poisson', 'sole', 'bar ', 'loup ', 'cabillaud', 'dorade', 'lotte', 'turbot', 'sandre'],
    cible: { blanc: 3 }, corps: 2, regions: ['Bourgogne', 'Loire'], plat: 'poisson' },
  { k: ['huitre', 'fruits de mer', 'crevette', 'moule', 'coquillage', 'bulot', 'plateau'],
    cible: { blanc: 3, effervescent: 1 }, corps: 1, regions: ['Loire', 'Bourgogne', 'Savoie'], plat: 'fruits de mer' },
  { k: ['homard', 'langouste', 'saint-jacques', 'noix de saint jacques', 'crustace'],
    cible: { blanc: 3, effervescent: 1 }, corps: 3, regions: ['Bourgogne', 'Rhône Nord', 'Champagne'], plat: 'crustacés nobles' },
  { k: ['sushi', 'sashimi', 'japonais', 'poke'],
    cible: { blanc: 3, effervescent: 2 }, corps: 1, regions: ['Loire', 'Alsace', 'Champagne'], plat: 'cuisine japonaise' },
  { k: ['curry', 'thai', 'epice', 'indien', 'colombo', 'tajine', 'couscous'],
    cible: { blanc: 2, 'rosé': 2, rouge: 1, moelleux: 1 }, corps: 2, regions: ['Alsace', 'Rhône Sud', 'Provence'], plat: 'cuisine épicée' },
  { k: ['pizza', 'pates', 'spaghetti', 'lasagne', 'bolognaise', 'italien', 'risotto'],
    cible: { rouge: 3 }, corps: 2, regions: ['Toscane', 'Piémont', 'Italie', 'Rhône Sud', 'Languedoc'], plat: 'cuisine italienne' },
  { k: ['raclette', 'fondue', 'tartiflette', 'mont d or'],
    cible: { blanc: 3 }, corps: 1, regions: ['Savoie', 'Jura', 'Alsace'], plat: 'fromage fondu' },
  { k: ['fromage', 'comte', 'plateau de fromages', 'chevre', 'camembert', 'brie', 'roquefort', 'bleu'],
    cible: { blanc: 2, rouge: 2, moelleux: 1 }, corps: 2, regions: ['Jura', 'Bourgogne', 'Loire'], plat: 'fromages' },
  { k: ['foie gras'],
    cible: { moelleux: 3, blanc: 1, effervescent: 1 }, corps: 2, regions: ['Sud-Ouest', 'Bordeaux', 'Alsace'], plat: 'foie gras' },
  { k: ['chocolat', 'dessert au chocolat', 'fondant', 'moelleux au chocolat'],
    cible: { rouge: 2, moelleux: 2 }, corps: 3, regions: ['Rhône Sud', 'Sud-Ouest'], plat: 'dessert chocolat' },
  { k: ['dessert', 'tarte', 'fruit', 'gateau', 'patisserie', 'crepe'],
    cible: { moelleux: 3, effervescent: 2 }, corps: 1, regions: ['Loire', 'Alsace', 'Sud-Ouest'], plat: 'dessert fruité' },
  { k: ['apero', 'aperitif', 'tapas', 'amuse'],
    cible: { effervescent: 3, blanc: 2, 'rosé': 2 }, corps: 1, regions: ['Champagne', 'Loire', 'Provence'], plat: 'apéritif' },
  { k: ['barbecue', 'bbq', 'grillade', 'merguez', 'brochette'],
    cible: { rouge: 2, 'rosé': 2 }, corps: 2, regions: ['Languedoc', 'Provence', 'Rhône Sud'], plat: 'barbecue' },
  { k: ['mijote', 'boeuf bourguignon', 'pot au feu', 'daube', 'cassoulet', 'ragout', 'joue de boeuf'],
    cible: { rouge: 3 }, corps: 3, regions: ['Bourgogne', 'Sud-Ouest', 'Rhône Sud'], plat: 'plat mijoté' },
];

const MODIFICATEURS = [
  { k: ['creme', 'cremeux', 'beurre blanc', 'sauce blanche'], effet: (p) => { p.cible.blanc = (p.cible.blanc || 0) + 1; } },
  { k: ['sauce au vin', 'sauce vin rouge', 'bordelaise', 'marchand de vin'], effet: (p) => { p.cible.rouge = (p.cible.rouge || 0) + 1; p.corps = 3; } },
  { k: ['grille', 'plancha', 'braise'], effet: (p) => { p.corps = Math.min(3, p.corps + 1); } },
  { k: ['leger', 'frais', 'ete', 'dejeuner'], effet: (p) => { p.corps = Math.max(1, p.corps - 1); } },
];

// Analyse le texte du repas → profil cible
export function profilRepas(texte) {
  const t = ` ${norm(texte)} `;
  let profil = null;
  for (const p of PLATS) {
    if (p.k.some((k) => t.includes(norm(k)))) {
      profil = { cible: { ...p.cible }, corps: p.corps, regions: [...p.regions], plat: p.plat };
      break;
    }
  }
  if (!profil) profil = { cible: { rouge: 2, blanc: 2 }, corps: 2, regions: [], plat: null };
  for (const m of MODIFICATEURS) {
    if (m.k.some((k) => t.includes(norm(k)))) m.effet(profil);
  }
  return profil;
}

// occasion: 'semaine' | 'weekend' | 'grande'
const BUDGET = { semaine: [0, 30], weekend: [10, 80], grande: [25, Infinity] };

// Régions qui « marquent le coup » pour une grande occasion
const PRESTIGE = ['Bordeaux', 'Bourgogne', 'Champagne', 'Rhône Nord', 'Piémont', 'Toscane', 'Napa Valley', 'Ribera del Duero', 'Priorat'];

export function scoreBouteille(b, profil, occasion, annee, budgetMax = null) {
  if (!b.qty || b.qty <= 0) return null;
  // budget : filtre strict — au-delà, la bouteille n'entre pas en lice
  if (budgetMax && b.prix != null && b.prix > budgetMax) return { score: -1, raisons: [] };
  let score = 0;
  const raisons = [];

  // Données importées : la couleur peut arriver capitalisée (« Rouge ») —
  // sans minuscule forcée, le lookup échoue et la bouteille disparaît en silence.
  const couleur = String(b.couleur || '').toLowerCase();

  // 1. Accord couleur (déterminant)
  const wCouleur = profil.cible[couleur] || 0;
  if (wCouleur === 0) return { score: -1, raisons: [] }; // hors accord
  score += wCouleur * 10;

  // 2. Corps
  const corps = corpsDe(b.region, couleur);
  const deltaCorps = Math.abs(corps - profil.corps);
  score += (2 - deltaCorps) * 4;
  if (deltaCorps === 0) raisons.push(t('somm.structureOk'));

  // 3. Région recommandée
  const iReg = profil.regions.indexOf(b.region);
  if (iReg >= 0) { score += (3 - iReg) * 3; raisons.push(t('somm.accordRegion').replace('{region}', b.region).replace('{plat}', profil.plat || t('somm.ceRepas'))); }

  // 4. Maturité — on privilégie l'apogée et on sauve les urgences
  const m = maturite(b, annee);
  if (m.code === 'apogee') { score += 8; raisons.push(t('somm.apogee')); }
  else if (m.code === 'urgent') { score += 10; raisons.push(t('somm.urgent')); }
  else if (m.code === 'approche') { score += 3; raisons.push(t('somm.approche')); }
  else if (m.code === 'jeune') { score -= 8; raisons.push(t('somm.jeune')); }
  else if (m.code === 'passe') { score -= 3; }

  // 5. Prix vs occasion
  if (b.prix != null) {
    const [lo, hi] = BUDGET[occasion] || BUDGET.weekend;
    if (b.prix >= lo && b.prix <= hi) score += 4;
    else if (occasion === 'semaine' && b.prix > 60) { score -= 10; raisons.push(t('somm.tropPrecieux')); }
    else if (occasion === 'grande' && b.prix < 15) score -= 4;
    if (occasion === 'grande' && b.prix >= 50) raisons.push(t('somm.grandeOccasion'));
  }

  // 5 bis. Le caractère de l'occasion, au-delà du prix
  const anneeRef = annee || new Date().getFullYear();
  if (occasion === 'grande') {
    if (PRESTIGE.includes(b.region)) { score += 3; raisons.push(t('somm.signatureRegion').replace('{region}', b.region)); }
    if (b.millesime && anneeRef - b.millesime >= 8 && m.code !== 'passe') {
      score += 3; raisons.push(t('somm.maturiteMillesime').replace('{millesime}', b.millesime));
    }
  }
  if (occasion === 'semaine') {
    if (corps === 3) score -= 2; // un mardi soir appelle plus de souplesse
    if (b.prix != null && b.prix > 80) score -= 4; // on épargne les trésors
  }

  // 6. Abondance : on pioche d'abord là où il y a du stock
  if (b.qty >= 3) score += 1;

  return { score, raisons, maturite: m };
}

// Point d'entrée : repas (texte) + cave + occasion → top N argumenté
export function recommander(texteRepas, bottles, occasion = 'weekend', n = 3, annee, budgetMax = null) {
  const profil = profilRepas(texteRepas);
  const classement = bottles
    .map((b) => {
      const r = scoreBouteille(b, profil, occasion, annee, budgetMax);
      return r && r.score >= 0 ? { bottle: b, ...r } : null;
    })
    .filter(Boolean)
    .sort((a, z) => z.score - a.score)
    .slice(0, n);
  return { profil, choix: classement };
}

// Sélection « surprise » pondérée : favorise apogée/urgent, évite les trop jeunes.
export function surprise(bottles, annee, alea = Math.random()) {
  const pool = bottles.filter((b) => b.qty > 0).map((b) => {
    const m = maturite(b, annee);
    const poids = { urgent: 5, apogee: 4, approche: 2, passe: 1, jeune: 0.3 }[m.code];
    return { b, poids };
  });
  const total = pool.reduce((s, x) => s + x.poids, 0);
  if (!total) return null;
  let tirage = alea * total;
  for (const x of pool) { tirage -= x.poids; if (tirage <= 0) return x.b; }
  return pool[pool.length - 1].b;
}

// Argumentaire du sommelier, personnalisé par bouteille et par rang :
// la première carte affirme l'évidence, la deuxième propose l'alternative,
// la troisième tente le pari. Cépages et notes viennent de CARACTERES ;
// un détail de service conclut. Aucune carte ne ressemble à sa voisine.
export function argumentaire(choix, profil, rang = 0) {
  const b = choix.bottle;
  const nom = [b.nom, b.millesime].filter(Boolean).join(' ');
  const pPlat = profil.plat ? t(`somm.plat.${profil.plat.replace(/ \/ | /g, '').toLowerCase().replace(/[éè]/g, 'e')}`) || profil.plat : '';
  const plat = pPlat ? (pPlat.match(/^[aeiouéè]/i) ? `l'${pPlat}` : `votre ${pPlat}`) : t('somm.ceRepas');
  const carac = caractereDe(b.region, b.couleur);
  const cepages = b.cepages || carac?.cep;

  const accroches = [
    t('somm.accroche0').replace('{plat}', plat).replace('{nom}', nom),
    t('somm.accroche1').replace('{nom}', nom),
    t('somm.accroche2').replace('{nom}', nom),
  ];
  let phrase = accroches[Math.min(rang, 2)];

  // l'identité du vin : cépages puis arômes typiques.
  // Si la bouteille a sa propre description (IA ou saisie), on n'invente pas
  // de notes génériques qui contrediraient ce que la fiche affiche.
  const notesOk = !b.description && carac;
  const _cepage = rang === 1 ? `Son ${cepages}` : `Le ${cepages}`;
  if (cepages) phrase += ' ' + (notesOk ? t('somm.cepageParle').replace('{cepage}', _cepage).replace('{notes}', carac.notes) : t('somm.cepageParleSimple').replace('{cepage}', _cepage));
  else if (notesOk) phrase += ' ' + t('somm.onRetrouve').replace('{notes}', carac.notes);
  if (cepages || notesOk) phrase += rang === 2 ? t('somm.grainFolie') : t('somm.finTable');

  // une raison du moteur — décalée selon le rang pour que deux cartes
  // voisines ne répètent pas le même argument
  if (choix.raisons.length) {
    const raison = choix.raisons[rang % choix.raisons.length];
    phrase += ` ${raison.charAt(0).toUpperCase()}${raison.slice(1)}.`;
  }

  // un conseil de service pour finir, selon la couleur, la maturité et le rang
  const couleur = String(b.couleur || '').toLowerCase();
  const m = choix.maturite;
  if (couleur === 'rouge') {
    phrase += ' ' + (m && m.code === 'jeune'
      ? t('somm.serviceRougeJeune')
      : [t('somm.serviceRouge0'),
         t('somm.serviceRouge1'),
         t('somm.serviceRouge2')][rang % 3]);
  } else if (couleur === 'effervescent') phrase += ' ' + t('somm.serviceEffervescent');
  else if (couleur === 'blanc') phrase += ' ' + t('somm.serviceBlanc');
  else if (couleur === 'rosé') phrase += ' ' + t('somm.serviceRose');
  else if (couleur === 'moelleux') phrase += ' ' + t('somm.serviceMoelleux');

  return phrase;
}

// Score brut → pourcentage d'accord affichable. Le maximum théorique est ~62
// (couleur 30 + corps 8 + région 9 + maturité 10 + budget 4 + stock 1) ;
// on borne à [45, 98] : en-dessous la reco n'aurait pas été retenue,
// et 100 % serait un mensonge de sommelier.
export function pctAccord(score) {
  return Math.max(45, Math.min(98, Math.round((score / 62) * 100)));
}
