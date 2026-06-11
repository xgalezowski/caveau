// Génère js/monde.js : fond de carte mondial allégé pour la vue Carte.
//
// Source : world-atlas (Natural Earth 110m, domaine public), TopoJSON décodé
// à la main (pas de dépendance). Projection équirectangulaire — la même
// fonction `projeter(lon, lat)` est exportée vers l'app, ce qui permet de
// placer les régions viticoles par leurs vraies coordonnées GPS.
//
// Usage : node scripts/gen-monde.mjs   (réseau requis, à ne lancer qu'en dev)

import { writeFileSync } from 'node:fs';

const URL_TOPO = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Cadre : monde entier sans l'Antarctique (aucune vigne là-bas)
const LARGEUR = 1000;
const HAUTEUR_TOTALE = 500; // 360° x 180° → 1000 x 500
const LAT_MIN = -56;        // coupe sous la Patagonie
const HAUTEUR = Math.round(((90 - LAT_MIN) / 180) * HAUTEUR_TOTALE); // ≈ 406

const projeter = (lon, lat) => [
  ((lon + 180) / 360) * LARGEUR,
  ((90 - lat) / 180) * HAUTEUR_TOTALE,
];

const rep = await fetch(URL_TOPO);
if (!rep.ok) throw new Error(`Téléchargement échoué : ${rep.status}`);
const topo = await rep.json();

// ── Décodage TopoJSON : arcs delta-encodés et quantifiés ──
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

function anneau(indices) {
  let pts = [];
  for (const i of indices) {
    const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    pts = pts.length ? pts.concat(a.slice(1)) : a.slice();
  }
  return pts;
}

const arr1 = (n) => Math.round(n * 10) / 10;

function cheminDepuisAnneaux(anneaux) {
  const morceaux = [];
  for (const indices of anneaux) {
    const pts = anneau(indices).map(([lon, lat]) => projeter(lon, lat).map(arr1));
    // ignorer les micro-îlots invisibles à cette échelle
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < 1.6 && Math.max(...ys) - Math.min(...ys) < 1.6) continue;
    // dédoublonner les points consécutifs identiques après arrondi
    const nets = pts.filter((p, i) => !i || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (nets.length < 3) continue;
    // anneaux traversant l'antiméridien (Russie, Fidji) : un saut de longitude
    // de ~360° devient une ligne horizontale qui barre toute la carte —
    // on découpe l'anneau à chaque saut, chaque fragment se referme seul.
    const fragments = [[nets[0]]];
    for (let i = 1; i < nets.length; i++) {
      if (Math.abs(nets[i][0] - nets[i - 1][0]) > LARGEUR / 2) fragments.push([]);
      fragments[fragments.length - 1].push(nets[i]);
    }
    for (const frag of fragments) {
      if (frag.length < 3) continue;
      morceaux.push(`M${frag.map((p) => `${p[0]},${p[1]}`).join('L')}Z`);
    }
  }
  return morceaux.join('');
}

const formes = [];
for (const g of topo.objects.countries.geometries) {
  const nom = g.properties?.name || '';
  if (nom === 'Antarctica') continue;
  const anneaux = g.type === 'Polygon' ? g.arcs : g.arcs.flat();
  const d = cheminDepuisAnneaux(g.type === 'Polygon' ? g.arcs : g.arcs.map((p) => p).flat());
  void anneaux;
  if (d) formes.push({ n: nom, d });
}

const sortie = `// Fond de carte mondial — GÉNÉRÉ par scripts/gen-monde.mjs, ne pas éditer.
// Données : Natural Earth 110m via world-atlas (domaine public).
// Projection équirectangulaire : projeter(lon, lat) → [x, y] dans la viewBox.

export const CARTE_VB = '0 0 ${LARGEUR} ${HAUTEUR}';

export const projeter = (lon, lat) => [
  ((lon + 180) / 360) * ${LARGEUR},
  ((90 - lat) / 180) * ${HAUTEUR_TOTALE},
];

export const PAYS_FORMES = ${JSON.stringify(formes)};
`;

writeFileSync(new URL('../js/monde.js', import.meta.url), sortie);
const ko = Math.round(Buffer.byteLength(sortie) / 1024);
console.log(`js/monde.js généré : ${formes.length} pays, ${ko} Ko`);
