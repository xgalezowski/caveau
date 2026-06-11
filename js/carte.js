// La Mappemonde du Caveau : volumes par pays sur fond Natural Earth,
// zoom animé sur un pays, bulles des régions viticoles placées à leurs
// vraies coordonnées GPS, panneau de détail par région.
//
// Tout est en unités viewBox (1000 × 406). Le fond (g-pays) est zoomé par
// transform CSS animé ; les bulles vivent dans un calque NON zoomé et sont
// repositionnées en coordonnées écran — leur taille reste constante.

import { CARTE_VB, projeter, PAYS_FORMES } from './monde.js';
import { paysParDefaut } from './wine-data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Nom français (app) → nom anglais (Natural Earth) */
const NOMS_EN = {
  'France': 'France', 'Italie': 'Italy', 'Espagne': 'Spain', 'Argentine': 'Argentina',
  'Chili': 'Chile', 'Géorgie': 'Georgia', 'Allemagne': 'Germany', 'Grèce': 'Greece',
  'Portugal': 'Portugal', 'Suisse': 'Switzerland', 'Autriche': 'Austria',
  'États-Unis': 'United States of America', 'Afrique du Sud': 'South Africa',
  'Australie': 'Australia', 'Nouvelle-Zélande': 'New Zealand',
};

/* Cœur viticole de chaque pays : ancre de la bulle au niveau monde */
const ANCRES_PAYS = {
  'France': [2.3, 46.8], 'Italie': [12.2, 43.5], 'Espagne': [-3.7, 40.3],
  'Argentine': [-67.5, -33.5], 'Chili': [-71, -33.8], 'Géorgie': [44.5, 42],
  'Allemagne': [8.5, 49.6], 'Grèce': [22.5, 38.8], 'Portugal': [-8, 40],
  'Suisse': [7.5, 46.4], 'Autriche': [15.8, 48.2], 'États-Unis': [-121, 40],
  'Afrique du Sud': [19, -33.7], 'Australie': [140, -34.5], 'Nouvelle-Zélande': [172.6, -41.5],
};

/* Régions viticoles → [lon, lat] réels */
const GEO_REGIONS = {
  // France
  'Bordeaux': [-0.58, 44.84], 'Bourgogne': [4.85, 47.05], 'Rhône Nord': [4.83, 45.07],
  'Rhône Sud': [4.81, 44.05], 'Loire': [0.2, 47.3], 'Alsace': [7.45, 48.3],
  'Champagne': [4.03, 49.05], 'Beaujolais': [4.6, 46.15], 'Languedoc': [3.0, 43.5],
  'Provence': [6.0, 43.5], 'Sud-Ouest': [0.9, 43.9], 'Jura': [5.55, 46.7],
  'Savoie': [6.1, 45.6], 'Corse': [9.0, 42.2], 'Vin de France': [2.5, 47.6],
  // Italie
  'Piémont': [8.0, 44.9], 'Toscane': [11.2, 43.4], 'Vénétie': [11.8, 45.5],
  'Sicile': [14.0, 37.5], 'Abruzzes': [13.9, 42.2], 'Pouilles': [16.6, 41.0],
  'Campanie': [14.8, 40.9], 'Lombardie': [9.9, 45.6],
  // Espagne
  'Rioja': [-2.45, 42.45], 'Ribera del Duero': [-3.8, 41.6], 'Priorat': [0.8, 41.2],
  'Galice': [-8.1, 42.6], 'Catalogne': [1.5, 41.6], 'Castille': [-4.0, 40.0], 'Andalousie': [-4.8, 37.3],
  // Amériques
  'Mendoza': [-68.85, -32.9], 'Salta': [-65.4, -24.8], 'Patagonie': [-68.0, -39.0],
  'Vallée de Maipo': [-70.7, -33.7], 'Colchagua': [-71.3, -34.6], 'Casablanca': [-71.4, -33.3],
  'Napa Valley': [-122.3, 38.5], 'Sonoma': [-122.7, 38.4], 'Oregon': [-123.0, 45.2],
  // Géorgie, Allemagne, Grèce, Portugal
  'Kakhétie': [45.7, 41.9], 'Karthlie': [44.5, 41.9], 'Iméréthie': [42.7, 42.2],
  'Moselle': [6.9, 49.9], 'Rheingau': [8.0, 50.0], 'Palatinat': [8.1, 49.3],
  'Rheinhessen': [8.2, 49.8], 'Bade': [7.9, 48.5], 'Franconie': [10.0, 49.8],
  'Santorin': [25.4, 36.4], 'Naoussa': [22.1, 40.6], 'Némée': [22.7, 37.8],
  'Mantinée': [22.4, 37.6], 'Crète': [24.9, 35.3],
  'Douro': [-7.8, 41.2], 'Vinho Verde': [-8.4, 41.7], 'Alentejo': [-7.9, 38.5],
};

/* Cadre initial : le « monde viticole » (on coupe Arctique et océans vides) */
const CADRE_MONDE = [[-128, 62], [180, -47]]; // [lon,lat] NO → SE

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/* Teinte choroplèthe : bordeaux sombre → or selon l'intensité 0..1 */
function teinte(t) {
  const a = [114, 47, 55], b = [201, 162, 39];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function creerCarte(racine, { surFiche, surCave }) {
  const [, , VB_L, VB_H] = CARTE_VB.split(' ').map(Number);

  racine.innerHTML = `
    <div class="carte-cadre">
      <button class="carte-retour" id="carte-retour" hidden>‹ Monde</button>
      <svg viewBox="${CARTE_VB}" class="carte-svg" role="img" aria-label="Carte de ma cave par pays">
        <g id="g-pays"></g>
        <g id="g-bulles"></g>
      </svg>
    </div>
    <p class="carte-legende" id="carte-legende"></p>
    <div class="panneau-region" id="panneau-region"></div>`;

  const svg = racine.querySelector('.carte-svg');
  const gPays = racine.querySelector('#g-pays');
  const gBulles = racine.querySelector('#g-bulles');
  const btnRetour = racine.querySelector('#carte-retour');
  const legende = racine.querySelector('#carte-legende');
  const panneau = racine.querySelector('#panneau-region');

  gPays.style.transition = reduitMouvement() ? 'none' : 'transform .65s cubic-bezier(.25, .9, .3, 1)';
  gPays.style.transformOrigin = '0 0';

  // Fond : tous les pays, une seule fois
  const formesParNom = {};
  for (const f of PAYS_FORMES) {
    const p = el('path', { d: f.d, class: 'pays-forme' });
    gPays.appendChild(p);
    formesParNom[f.n] = p;
  }

  let zoom = { s: 1, tx: 0, ty: 0 };   // transform courant du fond
  let paysActif = null;                 // pays zoomé (nom FR) ou null
  let donnees = { parPays: new Map(), bouteilles: [] };

  const enEcran = ([x, y]) => [x * zoom.s + zoom.tx, y * zoom.s + zoom.ty];

  /* Calcule le transform pour cadrer une bbox [x,y,l,h] (unités viewBox) */
  function cadrer([x, y, l, h], marge = 0.22) {
    const mx = l * marge + 14, my = h * marge + 14;
    const s = Math.min(VB_L / (l + mx * 2), VB_H / (h + my * 2), 16);
    return {
      s,
      tx: (VB_L - l * s) / 2 - x * s,
      ty: (VB_H - h * s) / 2 - y * s,
    };
  }

  function appliquerZoom(z) {
    zoom = z;
    gPays.style.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.s})`;
  }

  function bboxDePoints(points, margeDeg = 1.6) {
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const m = margeDeg * (1000 / 360);
    const x = Math.min(...xs) - m, y = Math.min(...ys) - m;
    return [x, y, Math.max(...xs) - x + m, Math.max(...ys) - y + m];
  }

  /* ── Agrégation : bouteilles → volumes par pays / région ── */
  function agreger(bouteilles) {
    const parPays = new Map();
    for (const b of bouteilles) {
      const pays = b.pays || paysParDefaut(b.region) || 'France';
      if (!parPays.has(pays)) parPays.set(pays, { vol: 0, valeur: 0, regions: new Map() });
      const p = parPays.get(pays);
      p.vol += b.qty;
      p.valeur += (b.prix || 0) * b.qty;
      const r = b.region || 'Autre';
      if (!p.regions.has(r)) p.regions.set(r, { vol: 0, bouteilles: [] });
      p.regions.get(r).vol += b.qty;
      p.regions.get(r).bouteilles.push(b);
    }
    return parPays;
  }

  /* Anti-chevauchement : écarte itérativement les bulles trop proches
     (l'Europe viticole est dense — France, Italie, Espagne se touchent) */
  function ecarterBulles(entrees, iterations = 4) {
    for (let k = 0; k < iterations; k++) {
      for (let i = 0; i < entrees.length; i++) {
        for (let j = i + 1; j < entrees.length; j++) {
          const a = entrees[i], b = entrees[j];
          const dx = b.cx - a.cx, dy = b.cy - a.cy;
          const d = Math.hypot(dx, dy) || 1;
          const min = a.r + b.r + 6;
          if (d >= min) continue;
          const pousse = (min - d) / 2, ux = dx / d, uy = dy / d;
          a.cx -= ux * pousse; a.cy -= uy * pousse;
          b.cx += ux * pousse; b.cy += uy * pousse;
        }
      }
    }
  }

  /* ── Bulles (calque écran, taille constante quel que soit le zoom) ── */
  function bulle({ cx, cy, r, libelle, sousLibelle, surTap, delai = 0 }) {
    const g = el('g', { class: 'bulle' });
    g.style.animationDelay = `${delai}ms`;
    g.appendChild(el('circle', { class: 'bulle-halo', cx, cy, r: r + 7 }));
    g.appendChild(el('circle', { class: 'bulle-corps', cx, cy, r }));
    const t = el('text', { class: 'bulle-nombre', x: cx, y: cy + r * 0.32, 'text-anchor': 'middle' });
    t.style.fontSize = `${Math.max(16, r * 0.95)}px`;
    t.textContent = libelle;
    g.appendChild(t);
    if (sousLibelle) {
      const s = el('text', { class: 'bulle-nom', x: cx, y: cy + r + 22, 'text-anchor': 'middle' });
      s.textContent = sousLibelle;
      g.appendChild(s);
    }
    // cible tactile invisible, plus large que la bulle
    const hit = el('circle', { cx, cy, r: Math.max(r + 16, 38), fill: 'transparent' });
    hit.style.cursor = 'pointer';
    hit.addEventListener('click', surTap);
    g.appendChild(hit);
    gBulles.appendChild(g);
  }

  /* ── Niveau monde ── */
  function rendreMonde() {
    paysActif = null;
    btnRetour.hidden = true;
    panneau.innerHTML = '';
    gBulles.innerHTML = '';

    const volMax = Math.max(1, ...[...donnees.parPays.values()].map((p) => p.vol));
    // teinte des pays
    for (const p of Object.values(formesParNom)) { p.classList.remove('a-vin'); p.style.fill = ''; }
    for (const [pays, infos] of donnees.parPays) {
      const forme = formesParNom[NOMS_EN[pays]];
      if (!forme) continue;
      forme.classList.add('a-vin');
      forme.style.fill = teinte(0.25 + 0.75 * (infos.vol / volMax));
    }

    const coins = [projeter(CADRE_MONDE[0][0], CADRE_MONDE[0][1]), projeter(CADRE_MONDE[1][0], CADRE_MONDE[1][1])];
    appliquerZoom(cadrer(bboxDePoints(coins, 0), 0.01));

    // bulles après le zoom (ou tout de suite si mouvement réduit)
    setTimeout(() => {
      if (paysActif) return;
      gBulles.innerHTML = '';
      const entrees = [...donnees.parPays.entries()].map(([pays, infos]) => {
        const ancre = ANCRES_PAYS[pays] || [0, 0];
        const [cx, cy] = enEcran(projeter(ancre[0], ancre[1]));
        return { pays, infos, cx, cy, r: 17 + Math.min(17, Math.sqrt(infos.vol) * 3.4) };
      }).sort((a, z) => z.infos.vol - a.infos.vol); // grosses bulles dessous
      ecarterBulles(entrees);
      entrees.forEach((e, i) => bulle({
        cx: e.cx, cy: e.cy, r: e.r,
        libelle: e.infos.vol,
        surTap: () => zoomPays(e.pays),
        delai: i * 70,
      }));
    }, reduitMouvement() ? 0 : 500);

    const nbPays = donnees.parPays.size;
    legende.textContent = nbPays
      ? `${nbPays} pays représenté${nbPays > 1 ? 's' : ''} — touchez un pays pour explorer ses régions`
      : 'Votre cave est vide — la carte attend ses premières bouteilles';
  }

  /* ── Niveau pays ── */
  function zoomPays(pays) {
    const infos = donnees.parPays.get(pays);
    if (!infos) return;
    paysActif = pays;
    btnRetour.hidden = false;
    gBulles.innerHTML = '';
    panneau.innerHTML = '';

    const points = [...infos.regions.keys()]
      .map((r) => GEO_REGIONS[r] || ANCRES_PAYS[pays])
      .filter(Boolean)
      .map(([lon, lat]) => projeter(lon, lat));
    if (!points.length) points.push(projeter(...(ANCRES_PAYS[pays] || [0, 30])));

    appliquerZoom(cadrer(bboxDePoints(points, 2.2)));

    setTimeout(() => {
      if (paysActif !== pays) return;
      gBulles.innerHTML = '';
      const sansGeo = [];
      const entrees = [];
      for (const [region, r] of [...infos.regions.entries()].sort((a, z) => z[1].vol - a[1].vol)) {
        const geo = GEO_REGIONS[region];
        if (!geo) { sansGeo.push([region, r]); continue; }
        const [cx, cy] = enEcran(projeter(geo[0], geo[1]));
        entrees.push({ region, cx, cy, r: 15 + Math.min(14, Math.sqrt(r.vol) * 3.2), vol: r.vol });
      }
      ecarterBulles(entrees);
      entrees.forEach((e, i) => bulle({
        cx: e.cx, cy: e.cy, r: e.r,
        libelle: e.vol,
        sousLibelle: e.region,
        surTap: () => montrerRegion(pays, e.region),
        delai: i * 80,
      }));
      // régions sans coordonnées connues : alignées sous la carte, même rôle
      if (sansGeo.length) {
        panneau.innerHTML = `<div class="chips-inspi" style="margin-top:10px">${sansGeo
          .map(([region, r]) => `<button class="chip-inspi" data-region="${esc(region)}">${esc(region)} · ${r.vol}</button>`).join('')}</div>`;
        panneau.querySelectorAll('[data-region]').forEach((c) => {
          c.onclick = () => montrerRegion(pays, c.dataset.region);
        });
      }
    }, reduitMouvement() ? 0 : 600);

    legende.textContent = `${pays} — ${infos.vol} bouteille${infos.vol > 1 ? 's' : ''}${infos.valeur ? ` · ${Math.round(infos.valeur)} €` : ''}`;
  }

  /* ── Panneau région : les bouteilles, et la porte vers la Cave ── */
  const MAT_LIBELLES = { apogee: 'apogée', urgent: 'à boire vite', approche: 'bientôt', jeune: 'jeune', passe: 'déclin' };
  function montrerRegion(pays, region) {
    const r = donnees.parPays.get(pays)?.regions.get(region);
    if (!r) return;
    const valeur = r.bouteilles.reduce((s, b) => s + (b.prix || 0) * b.qty, 0);
    panneau.innerHTML = `
      <div class="panneau-titre">
        <h3>${esc(region)}</h3>
        <span>${r.vol} btl${valeur ? ` · ${Math.round(valeur)} €` : ''}</span>
      </div>
      ${r.bouteilles.map((b) => `
        <button class="panneau-btl" data-id="${esc(b.id)}">
          <span class="carte-couleur c-${esc(String(b.couleur || 'rouge').toLowerCase())}" style="height:34px"></span>
          <span class="panneau-btl-corps">
            <span class="panneau-btl-nom">${esc(b.nom)} ${b.millesime ? `<i>${b.millesime}</i>` : ''}</span>
            <span class="panneau-btl-meta">×${b.qty}${b.prix ? ` · ${b.prix} €` : ''}</span>
          </span>
          <span class="panneau-btl-fleche">›</span>
        </button>`).join('')}
      <button class="btn-fantome" id="carte-vers-cave">Voir ${esc(region)} dans la cave</button>`;
    panneau.querySelectorAll('.panneau-btl').forEach((btn) => {
      btn.onclick = () => surFiche(btn.dataset.id);
    });
    panneau.querySelector('#carte-vers-cave').onclick = () => surCave(region);
    panneau.scrollIntoView({ behavior: reduitMouvement() ? 'auto' : 'smooth', block: 'nearest' });
  }

  btnRetour.onclick = () => rendreMonde();

  return {
    rendre(bouteilles) {
      donnees = { parPays: agreger(bouteilles), bouteilles };
      if (paysActif && donnees.parPays.has(paysActif)) zoomPays(paysActif);
      else rendreMonde();
    },
  };
}
