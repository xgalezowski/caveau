// Harnais de vérification des modules purs : node tests/run.js
import { parseLigne, parseTexte } from '../js/parser.js';
import { recommander, surprise, profilRepas, argumentaire } from '../js/sommelier.js';
import { maturite, gardeParDefaut } from '../js/wine-data.js';

let ok = 0, ko = 0;
function check(nom, cond, detail = '') {
  if (cond) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.error(`  ✗ ${nom} ${detail}`); }
}

console.log('— Parser —');
const b1 = parseLigne('3 bouteilles de Gevrey-Chambertin 2019 domaine Dugat, 65€');
check('quantité', b1.qty === 3, `→ ${b1.qty}`);
check('millésime', b1.millesime === 2019, `→ ${b1.millesime}`);
check('prix', b1.prix === 65, `→ ${b1.prix}`);
check('région Bourgogne', b1.region === 'Bourgogne', `→ ${b1.region}`);
check('couleur rouge', b1.couleur === 'rouge', `→ ${b1.couleur}`);
check('domaine', /dugat/i.test(b1.domaine || ''), `→ ${b1.domaine}`);
check('garde calculée', b1.gardeDe === 2023 && b1.gardeA === 2034, `→ ${b1.gardeDe}-${b1.gardeA}`);

const b2 = parseLigne('Sancerre blanc 2022, 18 euros');
check('Sancerre → Loire', b2.region === 'Loire', `→ ${b2.region}`);
check('blanc', b2.couleur === 'blanc', `→ ${b2.couleur}`);
check('prix euros', b2.prix === 18, `→ ${b2.prix}`);

const b3 = parseLigne('Champagne Bollinger x2');
check('Champagne effervescent', b3.couleur === 'effervescent', `→ ${b3.couleur}`);
check('x2', b3.qty === 2, `→ ${b3.qty}`);

const multi = parseTexte('Chinon 2020, 15€\nMeursault 2021 domaine Roulot, 80€; Tavel rosé 2023');
check('multi-lignes (3)', multi.length === 3, `→ ${multi.length}`);
check('Tavel rosé', multi[2].couleur === 'rosé', `→ ${multi[2].couleur}`);
check('Meursault blanc', multi[1].couleur === 'blanc', `→ ${multi[1].couleur}`);

console.log('— Maturité —');
const jeune = { millesime: 2024, gardeDe: 2029, gardeA: 2044 };
check('vin jeune', maturite(jeune, 2026).code === 'jeune');
const apogee = { millesime: 2018, gardeDe: 2023, gardeA: 2038 };
check('apogée', maturite(apogee, 2026).code === 'apogee');
const urgent = { millesime: 2015, gardeDe: 2016, gardeA: 2027 };
check('urgent', maturite(urgent, 2026).code === 'urgent');
check('passé', maturite(urgent, 2030).code === 'passe');

console.log('— Sommelier —');
const cave = [
  { id: 'a', nom: 'Château Test', region: 'Bordeaux', couleur: 'rouge', millesime: 2016, prix: 45, qty: 4, gardeDe: 2021, gardeA: 2036 },
  { id: 'b', nom: 'Chablis Test', region: 'Bourgogne', couleur: 'blanc', millesime: 2022, prix: 22, qty: 6, gardeDe: 2025, gardeA: 2032 },
  { id: 'c', nom: 'Tavel Test', region: 'Rhône Sud', couleur: 'rosé', millesime: 2023, prix: 12, qty: 2, gardeDe: 2024, gardeA: 2025 },
  { id: 'd', nom: 'Grand Cru Hors Budget', region: 'Bourgogne', couleur: 'rouge', millesime: 2019, prix: 250, qty: 1, gardeDe: 2023, gardeA: 2034 },
];
const r1 = recommander('côte de bœuf grillée et cèpes', cave, 'weekend', 3, 2026);
check('profil viande rouge', r1.profil.plat === 'viande rouge', `→ ${r1.profil.plat}`);
check('top1 = rouge', r1.choix[0]?.bottle.couleur === 'rouge', `→ ${r1.choix[0]?.bottle.nom}`);
check('pas de blanc en tête', r1.choix[0]?.bottle.id !== 'b');

const r2 = recommander('plateau de fruits de mer', cave, 'weekend', 3, 2026);
check('fruits de mer → blanc', r2.choix[0]?.bottle.couleur === 'blanc', `→ ${r2.choix[0]?.bottle.nom}`);

const r3 = recommander('entrecôte', cave, 'semaine', 3, 2026);
const hb = r3.choix.find((c) => c.bottle.id === 'd');
const ord = r3.choix.findIndex((c) => c.bottle.id === 'd');
check('hors budget pénalisé en semaine', !hb || ord > 0, `→ position ${ord}`);

const r4 = recommander('curry thaï', cave, 'weekend', 3, 2026);
check('épicé : pas un bordeaux puissant en tête', r4.choix[0]?.bottle.id !== 'a', `→ ${r4.choix[0]?.bottle.nom}`);

// Données importées (JSON externe) : couleur capitalisée ne doit pas éliminer la bouteille
const caveImportee = [{ id: 'i', nom: 'Import Test', region: 'Bordeaux', couleur: 'Rouge', millesime: 2016, prix: 30, qty: 2, gardeDe: 2021, gardeA: 2036 }];
const r5 = recommander('côte de bœuf', caveImportee, 'weekend', 3, 2026);
check('couleur capitalisée acceptée', r5.choix.length === 1, `→ ${r5.choix.length} choix`);

// Budget maximum : filtre strict
const r6 = recommander('entrecôte', cave, 'weekend', 3, 2026, 40);
check('budget 40 € : pas de bouteille au-dessus', r6.choix.every((c) => (c.bottle.prix ?? 0) <= 40), `→ ${r6.choix.map((c) => c.bottle.prix)}`);

// Grande occasion : le grand cru mûr remonte malgré son prix
const r7 = recommander('côte de bœuf', cave, 'grande', 3, 2026);
const posGrand = r7.choix.findIndex((c) => c.bottle.id === 'd');
check('grande occasion : le grand cru en lice', posGrand >= 0 && posGrand <= 1, `→ position ${posGrand}`);

// Argumentaires : personnalisés et différents par rang
const a0 = argumentaire(r1.choix[0], r1.profil, 0);
const a1 = argumentaire(r1.choix[0], r1.profil, 1);
check('argumentaire rang 0 ≠ rang 1', a0 !== a1);
check('argumentaire cite les cépages', /cabernet|merlot|syrah|pinot/i.test(a0), `→ ${a0.slice(0, 80)}…`);
check('argumentaire conseille le service', /carafez|servez|°C/i.test(a0));

const s = surprise(cave, 2026, 0.5);
check('surprise renvoie une bouteille', !!s && s.qty > 0);
check('cave vide → null', surprise([], 2026) === null);

const g = gardeParDefaut('Champagne', 'effervescent', 2020);
check('garde champagne', g.gardeDe === 2022 && g.gardeA === 2030, `→ ${g.gardeDe}-${g.gardeA}`);

console.log(`\n${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);
