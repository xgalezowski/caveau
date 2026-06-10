// Moteur d'accords mets-vins : analyse un repas en texte libre, score chaque
// bouteille de la cave (accord, maturité, prix vs occasion) et argumente.
// Module pur, testable sous Node.

import { corpsDe, maturite } from './wine-data.js';

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

export function scoreBouteille(b, profil, occasion, annee) {
  if (!b.qty || b.qty <= 0) return null;
  let score = 0;
  const raisons = [];

  // 1. Accord couleur (déterminant)
  const wCouleur = profil.cible[b.couleur] || 0;
  if (wCouleur === 0) return { score: -1, raisons: [] }; // hors accord
  score += wCouleur * 10;

  // 2. Corps
  const corps = corpsDe(b.region, b.couleur);
  const deltaCorps = Math.abs(corps - profil.corps);
  score += (2 - deltaCorps) * 4;
  if (deltaCorps === 0) raisons.push('structure parfaitement calibrée pour le plat');

  // 3. Région recommandée
  const iReg = profil.regions.indexOf(b.region);
  if (iReg >= 0) { score += (3 - iReg) * 3; raisons.push(`accord classique ${b.region} / ${profil.plat || 'ce plat'}`); }

  // 4. Maturité — on privilégie l'apogée et on sauve les urgences
  const m = maturite(b, annee);
  if (m.code === 'apogee') { score += 8; raisons.push('à son apogée en ce moment'); }
  else if (m.code === 'urgent') { score += 10; raisons.push('à boire en priorité avant qu\'il ne décline'); }
  else if (m.code === 'approche') { score += 3; raisons.push('proche de son apogée'); }
  else if (m.code === 'jeune') { score -= 8; raisons.push('encore jeune — dommage de l\'ouvrir maintenant'); }
  else if (m.code === 'passe') { score -= 3; }

  // 5. Prix vs occasion
  if (b.prix != null) {
    const [lo, hi] = BUDGET[occasion] || BUDGET.weekend;
    if (b.prix >= lo && b.prix <= hi) score += 4;
    else if (occasion === 'semaine' && b.prix > 60) { score -= 10; raisons.push('trop précieux pour un soir de semaine'); }
    else if (occasion === 'grande' && b.prix < 15) score -= 4;
    if (occasion === 'grande' && b.prix >= 50) raisons.push('une grande bouteille à la hauteur de l\'occasion');
  }

  // 6. Abondance : on pioche d'abord là où il y a du stock
  if (b.qty >= 3) score += 1;

  return { score, raisons, maturite: m };
}

// Point d'entrée : repas (texte) + cave + occasion → top N argumenté
export function recommander(texteRepas, bottles, occasion = 'weekend', n = 3, annee) {
  const profil = profilRepas(texteRepas);
  const classement = bottles
    .map((b) => {
      const r = scoreBouteille(b, profil, occasion, annee);
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

// Phrase d'accroche du sommelier pour une recommandation.
export function argumentaire(choix, profil) {
  const b = choix.bottle;
  const intro = profil.plat
    ? `Pour ${profil.plat === 'apéritif' ? 'l\'' : 'votre '}${profil.plat}, `
    : 'Pour ce repas, ';
  const nom = [b.nom, b.millesime].filter(Boolean).join(' ');
  const corpsTxt = ['', 'tout en finesse', 'équilibré', 'puissant et structuré'][corpsDe(b.region, b.couleur)];
  const raisons = choix.raisons.length ? ` — ${choix.raisons.slice(0, 2).join(', ')}` : '';
  return `${intro}je vous conseille le ${nom} (${b.region}, ${b.couleur}), ${corpsTxt}${raisons}.`;
}
