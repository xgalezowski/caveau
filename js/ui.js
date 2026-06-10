// Rendu des écrans et interactions. Toute la logique métier vit dans
// parser.js / sommelier.js / wine-data.js ; ici on ne fait qu'orchestrer.

import { store } from './store.js';
import { parseTexte, parseLigne } from './parser.js';
import { recommander, surprise, argumentaire } from './sommelier.js';
import { REGIONS, COULEURS, maturite, gardeParDefaut } from './wine-data.js';
import { dicter, parler, voixDisponible } from './voice.js';
import { analyserEtiquette, sommelierPlus, equivalents } from './ai.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ecranActif = 'cave';
let filtreCouleur = null;
let occasion = 'weekend';
let aAjouter = []; // bouteilles en attente de confirmation

/* ═══ Navigation ═══ */
export function montrerEcran(nom) {
  ecranActif = nom;
  document.querySelectorAll('.ecran').forEach((e) => { e.hidden = e.id !== `ecran-${nom}`; });
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('actif', b.dataset.ecran === nom));
  rendre(nom);
  window.scrollTo({ top: 0 });
}

function rendre(nom) {
  if (nom === 'cave') rendreCave();
  if (nom === 'alertes') rendreAlertes();
  if (nom === 'stats') rendreStats();
  if (nom === 'sommelier') rendreSommelierPlus();
  majBadgeAlertes();
}

/* ═══ Toast ═══ */
export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

/* ═══ CAVE ═══ */
function rendreCave() {
  const { bottles } = store.get();
  const enCave = bottles.filter((b) => b.qty > 0);
  const recherche = ($('#recherche').value || '').toLowerCase();

  const nb = enCave.reduce((s, b) => s + b.qty, 0);
  const valeur = enCave.reduce((s, b) => s + (b.prix || 0) * b.qty, 0);
  const aBoire = enCave.filter((b) => ['apogee', 'urgent'].includes(maturite(b).code)).reduce((s, b) => s + b.qty, 0);
  $('#bandeau-valeur').innerHTML = `
    <div><div class="v">${nb}</div><div class="l">bouteilles</div></div>
    <div><div class="v">${Math.round(valeur)} €</div><div class="l">valeur</div></div>
    <div><div class="v">${aBoire}</div><div class="l">à boire</div></div>`;

  // Filtres couleur
  $('#filtres-couleur').innerHTML = ['toutes', ...COULEURS].map((c) =>
    `<button class="puce ${((c === 'toutes' && !filtreCouleur) || c === filtreCouleur) ? 'actif' : ''}" data-c="${c}">${c === 'toutes' ? 'Toutes' : c}</button>`
  ).join('');
  $('#filtres-couleur').querySelectorAll('.puce').forEach((p) => p.onclick = () => {
    filtreCouleur = p.dataset.c === 'toutes' ? null : p.dataset.c;
    rendreCave();
  });

  let visibles = enCave;
  if (filtreCouleur) visibles = visibles.filter((b) => b.couleur === filtreCouleur);
  if (recherche) visibles = visibles.filter((b) =>
    `${b.nom} ${b.domaine || ''} ${b.appellation || ''} ${b.region} ${b.millesime || ''}`.toLowerCase().includes(recherche));

  if (!visibles.length) {
    $('#liste-cave').innerHTML = `<div class="vide"><div class="gros">${enCave.length ? 'Rien ne correspond' : 'Votre cave est vide'}</div>${enCave.length ? '' : 'Passez par l\'onglet <b>Ajouter</b> — à la voix, c\'est encore mieux.'}</div>`;
    return;
  }

  // Groupé par région, régions triées par valeur décroissante
  const groupes = {};
  visibles.forEach((b) => (groupes[b.region] ??= []).push(b));
  const regionsTriees = Object.keys(groupes).sort((a, z) =>
    groupes[z].reduce((s, b) => s + b.qty, 0) - groupes[a].reduce((s, b) => s + b.qty, 0));

  $('#liste-cave').innerHTML = regionsTriees.map((r) => {
    const liste = groupes[r].sort((a, z) => maturite(a).ordre - maturite(z).ordre);
    const nbR = liste.reduce((s, b) => s + b.qty, 0);
    return `<div class="groupe-region">${esc(r)} <small>${nbR} BTL</small></div>` +
      liste.map(carteHTML).join('');
  }).join('');

  $('#liste-cave').querySelectorAll('.carte').forEach((c) => c.onclick = () => ouvrirFiche(c.dataset.id));
}

function carteHTML(b) {
  const m = maturite(b);
  return `<div class="carte" data-id="${b.id}">
    <div class="carte-couleur c-${b.couleur}"></div>
    <div class="carte-corps">
      <div class="carte-nom">${esc(b.nom)} ${b.millesime ? `<span class="mil">${b.millesime}</span>` : ''}</div>
      <div class="carte-meta">${esc(b.appellation || b.region)}${b.prix ? ` · ${b.prix} €` : ''}</div>
      <span class="cachet cachet-${m.code}">${m.label}</span>
    </div>
    <div class="carte-fin"><div class="carte-qty">×<b>${b.qty}</b></div></div>
  </div>`;
}

/* ═══ Fiche bouteille (bottom sheet) ═══ */
function ouvrirFiche(id) {
  const b = store.get().bottles.find((x) => x.id === id);
  if (!b) return;
  const m = maturite(b);
  $('#feuille').innerHTML = `
    <h3>${esc(b.nom)} ${b.millesime ? `<em style="color:var(--or-clair)">${b.millesime}</em>` : ''}</h3>
    <p style="color:var(--creme-45);font-size:13px;margin-top:4px">${esc(b.domaine || '')}
      <span class="cachet cachet-${m.code}">${m.label}</span>
      ${b.gardeDe ? `<span style="margin-left:6px">garde ${b.gardeDe}–${b.gardeA}</span>` : ''}</p>
    <div class="ligne">
      <div style="flex:2"><label>Nom</label><input id="f-nom" value="${esc(b.nom)}"></div>
      <div style="flex:1"><label>Millésime</label><input id="f-mil" type="number" value="${b.millesime || ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>Région</label><select id="f-region">${REGIONS.map((r) => `<option ${r === b.region ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div style="flex:1"><label>Couleur</label><select id="f-couleur">${COULEURS.map((c) => `<option ${c === b.couleur ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>Prix (€)</label><input id="f-prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
      <div style="flex:1"><label>Quantité</label><input id="f-qty" type="number" min="0" value="${b.qty}"></div>
      <div style="flex:1"><label>Garde de</label><input id="f-gde" type="number" value="${b.gardeDe || ''}"></div>
      <div style="flex:1"><label>à</label><input id="f-gda" type="number" value="${b.gardeA || ''}"></div>
    </div>
    <div class="ligne"><div style="flex:1"><label>Notes</label><input id="f-notes" value="${esc(b.notes || '')}"></div></div>
    <div class="actions">
      <button class="btn-or" id="f-sortir" style="flex:1.4">🍷 Je la sors</button>
      <button class="btn-sombre" id="f-save" style="flex:1">Enregistrer</button>
    </div>
    <div class="liens-rachat" style="margin-top:14px">${liensRachatHTML(b)}</div>
    <div id="f-equiv"></div>
    ${store.get().settings.apiKey ? '<button class="btn-fantome" id="f-btn-equiv">✨ Trouver des équivalents (IA)</button>' : ''}
    <button class="btn-discret btn-danger" id="f-suppr" style="width:100%;margin-top:8px">Supprimer cette référence</button>`;
  montrerFeuille(true);

  $('#f-save').onclick = () => {
    store.majBouteille(id, {
      nom: $('#f-nom').value.trim() || b.nom,
      millesime: parseInt($('#f-mil').value) || null,
      region: $('#f-region').value, couleur: $('#f-couleur').value,
      prix: parseFloat($('#f-prix').value) || null,
      qty: Math.max(0, parseInt($('#f-qty').value) || 0),
      gardeDe: parseInt($('#f-gde').value) || null, gardeA: parseInt($('#f-gda').value) || null,
      notes: $('#f-notes').value,
    });
    montrerFeuille(false); rendre(ecranActif); toast('Fiche mise à jour');
  };
  $('#f-sortir').onclick = () => { montrerFeuille(false); dialogueSortie(id); };
  $('#f-suppr').onclick = () => {
    if (confirm(`Supprimer « ${b.nom} » de la cave ?`)) {
      store.supprimerBouteille(id); montrerFeuille(false); rendre(ecranActif); toast('Référence supprimée');
    }
  };
  const btnEq = $('#f-btn-equiv');
  if (btnEq) btnEq.onclick = async () => {
    btnEq.textContent = '✨ Le caviste réfléchit…'; btnEq.disabled = true;
    try {
      const rep = await equivalents(store.get().settings.apiKey, b);
      $('#f-equiv').innerHTML = `<div class="bulle-ia">${esc(rep)}</div>`;
    } catch (e) { toast(e.message); }
    btnEq.textContent = '✨ Trouver des équivalents (IA)'; btnEq.disabled = false;
  };
}

function dialogueSortie(id) {
  const b = store.get().bottles.find((x) => x.id === id);
  $('#feuille').innerHTML = `
    <h3>On ouvre le ${esc(b.nom)} ${b.millesime || ''} ?</h3>
    <div class="ligne"><div style="flex:1"><label>L'occasion</label><input id="s-occ" placeholder="Dîner entre amis, anniversaire…"></div></div>
    <div class="ligne"><div style="flex:1"><label>Première impression (optionnel)</label><input id="s-note" placeholder="Superbe, encore jeune, bouchonné…"></div></div>
    <div class="actions">
      <button class="btn-or" id="s-ok" style="flex:1">Santé ! 🥂</button>
      <button class="btn-sombre" id="s-annule" style="flex:.6">Annuler</button>
    </div>`;
  montrerFeuille(true);
  $('#s-ok').onclick = () => {
    store.sortirBouteille(id, $('#s-occ').value.trim(), $('#s-note').value.trim());
    montrerFeuille(false); rendre(ecranActif);
    const restant = store.get().bottles.find((x) => x.id === id)?.qty ?? 0;
    toast(restant > 0 ? `Bonne dégustation ! Il en reste ${restant}.` : 'C\'était la dernière — pensez au rachat 😉');
    majBadgeAlertes();
  };
  $('#s-annule').onclick = () => montrerFeuille(false);
}

function montrerFeuille(visible) {
  $('#feuille').hidden = !visible;
  $('#voile').hidden = !visible;
}

function liensRachatHTML(b) {
  const q = encodeURIComponent([b.nom, b.millesime].filter(Boolean).join(' '));
  const qApp = encodeURIComponent(b.appellation || b.nom);
  return `
    <a href="https://www.wine-searcher.com/find/${q}" target="_blank" rel="noopener">Wine-Searcher ↗</a>
    <a href="https://www.vivino.com/search/wines?q=${q}" target="_blank" rel="noopener">Vivino ↗</a>
    <a href="https://www.idealwine.com/fr/recherche/?q=${q}" target="_blank" rel="noopener">iDealwine ↗</a>
    <a href="https://www.google.com/search?tbm=shop&q=${qApp}+vin+promo" target="_blank" rel="noopener">Promos ↗</a>`;
}

/* ═══ AJOUTER ═══ */
function initAjouter() {
  $('#modes-ajout').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    $('#modes-ajout').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
    ['texte', 'voix', 'photo'].forEach((m) => { $(`#panneau-${m}`).hidden = m !== s.dataset.mode; });
  });
  if (!voixDisponible) $('#modes-ajout [data-mode="voix"]').style.display = 'none';

  $('#btn-analyser-texte').onclick = () => {
    const t = $('#saisie-texte').value.trim();
    if (!t) return toast('Décrivez d\'abord vos bouteilles');
    aAjouter = parseTexte(t);
    rendreApercu();
  };

  // Voix
  let rec = null;
  $('#btn-micro').onclick = () => {
    if (rec) { rec.stop(); return; }
    $('#btn-micro').classList.add('ecoute');
    $('#micro-aide').textContent = 'Je vous écoute…';
    rec = dicter({
      onResult: (txt, final) => {
        $('#transcript-ajout').textContent = txt;
        if (final) { aAjouter = parseTexte(txt); rendreApercu(); }
      },
      onEnd: () => { rec = null; $('#btn-micro').classList.remove('ecoute'); $('#micro-aide').textContent = 'Touchez et dictez : « deux bouteilles de Chinon 2020, quinze euros »'; },
      onError: (msg) => { toast(msg); },
    });
  };

  // Photo
  $('#input-photo').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const { apiKey } = store.get().settings;
    if (!apiKey) {
      $('#note-photo-ia').textContent = 'Astuce : ajoutez une clé API Claude dans Stats → Réglages pour la lecture automatique d\'étiquettes. En attendant, fiche manuelle pré-créée.';
      aAjouter = [parseLigne(f.name.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' '))];
      rendreApercu();
      return;
    }
    $('#note-photo-ia').textContent = '👁️ Lecture de l\'étiquette en cours…';
    try {
      const { base64, type } = await compresser(f);
      const r = await analyserEtiquette(apiKey, base64, type);
      const g = gardeParDefaut(r.region || 'Monde', r.couleur || 'rouge', r.millesime);
      aAjouter = [{
        nom: r.nom || 'Vin', domaine: r.domaine || '', appellation: r.appellation || null,
        region: REGIONS.includes(r.region) ? r.region : 'Monde',
        couleur: COULEURS.includes(r.couleur) ? r.couleur : 'rouge',
        millesime: r.millesime || null, prix: r.prixEstime || null, qty: 1, ...g,
      }];
      $('#note-photo-ia').textContent = '';
      rendreApercu();
    } catch (err) {
      $('#note-photo-ia').textContent = '';
      toast(`Lecture impossible (${err.message}) — saisie manuelle proposée`);
      aAjouter = [parseLigne('Vin à identifier')];
      rendreApercu();
    }
    e.target.value = '';
  };
}

async function compresser(file) {
  const img = await createImageBitmap(file);
  const max = 1100;
  const ratio = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * ratio); cv.height = Math.round(img.height * ratio);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  const dataUrl = cv.toDataURL('image/jpeg', .82);
  return { base64: dataUrl.split(',')[1], type: 'image/jpeg' };
}

function rendreApercu() {
  if (!aAjouter.length) { $('#apercu-ajout').innerHTML = ''; return; }
  $('#apercu-ajout').innerHTML = aAjouter.map((b, i) => `
    <div class="apercu" data-i="${i}">
      <h4>🍾 Bouteille ${aAjouter.length > 1 ? i + 1 : 'détectée'}</h4>
      <div class="ligne">
        <div style="flex:2"><label>Nom</label><input data-k="nom" value="${esc(b.nom)}"></div>
        <div style="flex:.8"><label>Millésime</label><input data-k="millesime" type="number" value="${b.millesime || ''}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>Région</label><select data-k="region">${REGIONS.map((r) => `<option ${r === b.region ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div style="flex:1"><label>Couleur</label><select data-k="couleur">${COULEURS.map((c) => `<option ${c === b.couleur ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>Prix (€)</label><input data-k="prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
        <div style="flex:1"><label>Quantité</label><input data-k="qty" type="number" min="1" value="${b.qty}"></div>
      </div>
    </div>`).join('') +
    `<button class="btn-or btn-large" id="btn-confirmer-ajout">Faire entrer en cave (${aAjouter.length})</button>`;

  $('#btn-confirmer-ajout').onclick = () => {
    document.querySelectorAll('.apercu').forEach((el) => {
      const b = aAjouter[+el.dataset.i];
      el.querySelectorAll('[data-k]').forEach((inp) => {
        const k = inp.dataset.k;
        b[k] = inp.type === 'number' ? (parseFloat(inp.value) || (k === 'qty' ? 1 : null)) : inp.value;
      });
      // recalcule la garde si région/millésime ont changé
      const g = gardeParDefaut(b.region, b.couleur, b.millesime);
      b.gardeDe = b.gardeDe || g.gardeDe; b.gardeA = b.gardeA || g.gardeA;
      store.ajouterBouteille(b);
    });
    const n = aAjouter.length;
    aAjouter = [];
    $('#apercu-ajout').innerHTML = '';
    $('#saisie-texte').value = ''; $('#transcript-ajout').textContent = '';
    toast(`${n} bouteille${n > 1 ? 's' : ''} en cave. Santé !`);
    parler(n > 1 ? `${n} bouteilles ajoutées à votre cave.` : 'Bouteille ajoutée à votre cave.', store.get().settings.voixActive);
    majBadgeAlertes();
  };
}

/* ═══ SOMMELIER ═══ */
function initSommelier() {
  $('#occasions').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    occasion = s.dataset.occ;
    $('#occasions').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
  });

  if (!voixDisponible) $('#btn-micro-repas').style.display = 'none';
  $('#btn-micro-repas').onclick = () => {
    $('#btn-micro-repas').classList.add('ecoute');
    dicter({
      onResult: (txt) => { $('#saisie-repas').value = txt; },
      onEnd: () => $('#btn-micro-repas').classList.remove('ecoute'),
      onError: (m) => toast(m),
    });
  };

  $('#btn-conseiller').onclick = () => {
    const repas = $('#saisie-repas').value.trim();
    if (!repas) return toast('Décrivez votre repas d\'abord');
    const enCave = store.get().bottles.filter((b) => b.qty > 0);
    if (!enCave.length) return toast('Votre cave est vide — ajoutez des bouteilles !');
    const { profil, choix } = recommander(repas, enCave, occasion);
    if (!choix.length) {
      $('#resultats-sommelier').innerHTML = `<div class="vide"><div class="gros">Rien d'idéal en cave…</div>Pour ${esc(profil.plat || 'ce plat')}, je chercherais un ${Object.entries(profil.cible).sort((a, z) => z[1] - a[1])[0][0]} ${profil.regions[0] ? 'de ' + profil.regions[0] : ''}. L'occasion d'un achat ?</div>`;
      return;
    }
    $('#resultats-sommelier').innerHTML = choix.map((c, i) => `
      <div class="reco ${i > 0 ? 'second' : ''}" data-id="${c.bottle.id}">
        <div class="reco-rang">${i + 1}</div>
        <div class="carte-nom">${esc(c.bottle.nom)} ${c.bottle.millesime ? `<span class="mil">${c.bottle.millesime}</span>` : ''}</div>
        <div class="carte-meta">${esc(c.bottle.region)} · ${c.bottle.couleur}${c.bottle.prix ? ` · ${c.bottle.prix} €` : ''} · ×${c.bottle.qty}</div>
        <div class="reco-texte">${esc(argumentaire(c, profil))}</div>
        <div class="reco-actions">
          <button data-act="sortir">🍷 Je la sors</button>
          <button data-act="fiche">Voir la fiche</button>
        </div>
      </div>`).join('');
    $('#resultats-sommelier').querySelectorAll('.reco').forEach((el) => {
      el.querySelector('[data-act="sortir"]').onclick = () => dialogueSortie(el.dataset.id);
      el.querySelector('[data-act="fiche"]').onclick = () => ouvrirFiche(el.dataset.id);
    });
    parler(argumentaire(choix[0], profil), store.get().settings.voixActive);
  };

  $('#btn-surprise').onclick = () => {
    const enCave = store.get().bottles.filter((b) => b.qty > 0);
    if (!enCave.length) return toast('Votre cave est vide !');
    const b = surprise(enCave);
    const m = maturite(b);
    $('#resultats-sommelier').innerHTML = `
      <div class="reco" data-id="${b.id}">
        <div class="reco-rang">🎲</div>
        <div class="carte-nom">${esc(b.nom)} ${b.millesime ? `<span class="mil">${b.millesime}</span>` : ''}</div>
        <div class="carte-meta">${esc(b.region)} · ${b.couleur}${b.prix ? ` · ${b.prix} €` : ''}</div>
        <div class="reco-texte">Le hasard a du goût : ${m.code === 'urgent' ? 'celle-ci n\'attendra pas, c\'est le moment parfait' : m.code === 'apogee' ? 'elle est à son apogée, foncez' : 'une jolie découverte pour ce soir'}.</div>
        <div class="reco-actions"><button data-act="sortir">🍷 Je la sors</button><button data-act="encore">🎲 Relancer</button></div>
      </div>`;
    const el = $('#resultats-sommelier .reco');
    el.querySelector('[data-act="sortir"]').onclick = () => dialogueSortie(b.id);
    el.querySelector('[data-act="encore"]').onclick = () => $('#btn-surprise').click();
    parler(`Ce soir, je vous propose le ${b.nom} ${b.millesime || ''}.`, store.get().settings.voixActive);
  };
}

function rendreSommelierPlus() {
  const { apiKey } = store.get().settings;
  $('#sommelier-plus').innerHTML = apiKey ? `
    <h3 class="sous-titre">Sommelier<em>+</em> — posez n'importe quelle question</h3>
    <div class="champ-repas">
      <textarea id="q-libre" rows="2" placeholder="Ex : que servir avec un couscous royal pour 8 personnes sans dépasser 25€ ?"></textarea>
    </div>
    <button class="btn-fantome" id="btn-q-libre">Demander au Sommelier+</button>
    <div id="rep-libre"></div>` : '';
  const btn = $('#btn-q-libre');
  if (btn) btn.onclick = async () => {
    const q = $('#q-libre').value.trim();
    if (!q) return;
    btn.textContent = 'Le sommelier descend à la cave…'; btn.disabled = true;
    try {
      const rep = await sommelierPlus(store.get().settings.apiKey, q, store.get().bottles);
      $('#rep-libre').innerHTML = `<div class="bulle-ia">${esc(rep)}</div>`;
      parler(rep, store.get().settings.voixActive);
    } catch (e) { toast(e.message); }
    btn.textContent = 'Demander au Sommelier+'; btn.disabled = false;
  };
}

/* ═══ ALERTES ═══ */
function compterVeille(w, bottles) {
  return bottles.filter((b) => b.qty > 0 && (
    (w.type === 'region' && b.region === w.valeur) ||
    (w.type === 'millesime' && String(b.millesime) === String(w.valeur)) ||
    (w.type === 'reference' && b.id === w.valeur)
  )).reduce((s, b) => s + b.qty, 0);
}

function alertesActuelles() {
  const { bottles, watches } = store.get();
  const basses = watches.map((w) => ({ w, n: compterVeille(w, bottles) })).filter((x) => x.n <= x.w.seuil);
  const urgentes = bottles.filter((b) => b.qty > 0 && maturite(b).code === 'urgent');
  const epuisees = bottles.filter((b) => b.qty === 0 && (b.sorties || []).length > 0).slice(-5);
  return { basses, urgentes, epuisees };
}

function majBadgeAlertes() {
  const { basses, urgentes } = alertesActuelles();
  const n = basses.length + urgentes.length;
  const badge = $('#badge-alertes');
  badge.hidden = n === 0;
  badge.textContent = n;
}

function rendreAlertes() {
  const { bottles } = store.get();
  const { basses, urgentes, epuisees } = alertesActuelles();
  let html = '';

  if (!basses.length && !urgentes.length && !epuisees.length) {
    html = '<div class="vide"><div class="gros">Tout va bien à la cave</div>Créez des veilles ci-dessous pour être prévenu quand un segment s\'épuise.</div>';
  }
  urgentes.forEach((b) => {
    html += `<div class="alerte"><div>⏳</div><div style="flex:1">
      <div class="alerte-titre">${esc(b.nom)} ${b.millesime || ''} — à boire vite</div>
      <div class="alerte-detail">Fin de fenêtre de garde ${b.gardeA}. Prévoyez une occasion (×${b.qty}).</div>
    </div></div>`;
  });
  basses.forEach(({ w, n }) => {
    const lib = w.type === 'reference' ? (bottles.find((b) => b.id === w.valeur)?.nom || 'Référence') : w.valeur;
    const q = w.type === 'reference' ? (bottles.find((b) => b.id === w.valeur)?.nom || '') : `vin ${w.valeur}`;
    html += `<div class="alerte douce"><div>📉</div><div style="flex:1">
      <div class="alerte-titre">Stock bas : ${esc(lib)}</div>
      <div class="alerte-detail">${n} bouteille${n > 1 ? 's' : ''} restante${n > 1 ? 's' : ''} (seuil : ${w.seuil}).</div>
      <div class="liens-rachat">
        <a href="https://www.wine-searcher.com/find/${encodeURIComponent(q)}" target="_blank" rel="noopener">Wine-Searcher ↗</a>
        <a href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q + ' promo')}" target="_blank" rel="noopener">Promos ↗</a>
      </div>
    </div></div>`;
  });
  epuisees.forEach((b) => {
    html += `<div class="alerte douce"><div>🫙</div><div style="flex:1">
      <div class="alerte-titre">Épuisé : ${esc(b.nom)} ${b.millesime || ''}</div>
      <div class="alerte-detail">Dernière sortie le ${(b.sorties || []).slice(-1)[0]?.date || '—'}. On rachète ?</div>
      <div class="liens-rachat">${liensRachatHTML(b)}</div>
    </div></div>`;
  });
  $('#liste-alertes').innerHTML = html;

  // Liste des veilles
  const { watches } = store.get();
  $('#liste-veilles').innerHTML = watches.length ? watches.map((w) => {
    const n = compterVeille(w, bottles);
    const lib = w.type === 'reference' ? (bottles.find((b) => b.id === w.valeur)?.nom || '(référence supprimée)') : w.valeur;
    return `<div class="veille-item">
      <span>${{ region: '🗺️', millesime: '📅', reference: '🍾' }[w.type]} ${esc(lib)}</span>
      <span><span class="${n <= w.seuil ? 'bas' : 'ok'}">${n}</span> / seuil ${w.seuil}
      <button class="btn-discret" data-id="${w.id}" style="padding:2px 6px">✕</button></span>
    </div>`;
  }).join('') : '<p style="color:var(--creme-45);font-size:13px">Aucune veille pour l\'instant.</p>';
  $('#liste-veilles').querySelectorAll('[data-id]').forEach((btn) => btn.onclick = () => {
    store.supprimerVeille(btn.dataset.id); rendreAlertes(); majBadgeAlertes();
  });

  majSlotVeille();
}

function majSlotVeille() {
  const { bottles } = store.get();
  const type = $('#veille-type').value;
  let opts = '';
  if (type === 'region') opts = [...new Set(bottles.map((b) => b.region))].sort().map((r) => `<option>${r}</option>`).join('') || REGIONS.map((r) => `<option>${r}</option>`).join('');
  if (type === 'millesime') opts = [...new Set(bottles.map((b) => b.millesime).filter(Boolean))].sort().map((m) => `<option>${m}</option>`).join('');
  if (type === 'reference') opts = bottles.map((b) => `<option value="${b.id}">${esc(b.nom)} ${b.millesime || ''}</option>`).join('');
  $('#veille-valeur-slot').innerHTML = `<select id="veille-valeur">${opts || '<option value="">(rien en cave)</option>'}</select>`;
}

function initAlertes() {
  $('#veille-type').onchange = majSlotVeille;
  $('#forme-veille').onsubmit = (e) => {
    e.preventDefault();
    const valeur = $('#veille-valeur')?.value;
    if (!valeur) return toast('Rien à veiller pour l\'instant');
    store.ajouterVeille({ type: $('#veille-type').value, valeur, seuil: parseInt($('#veille-seuil').value) || 1 });
    rendreAlertes(); majBadgeAlertes(); toast('Veille créée');
  };
}

/* ═══ STATS ═══ */
function rendreStats() {
  const { bottles, settings } = store.get();
  const enCave = bottles.filter((b) => b.qty > 0);
  const valeur = enCave.reduce((s, b) => s + (b.prix || 0) * b.qty, 0);
  const nb = enCave.reduce((s, b) => s + b.qty, 0);

  const parGroupe = (cle) => {
    const g = {};
    enCave.forEach((b) => { g[b[cle] || '—'] = (g[b[cle] || '—'] || 0) + b.qty; });
    return Object.entries(g).sort((a, z) => z[1] - a[1]);
  };
  const jauges = (entrees, doree = false) => {
    const max = Math.max(1, ...entrees.map(([, n]) => n));
    return entrees.map(([nom, n]) =>
      `<div class="jauge ${doree ? 'doree' : ''}"><span class="nom">${esc(String(nom))}</span><span class="barre"><span class="rempli" style="width:${(n / max) * 100}%"></span></span><span class="n">${n}</span></div>`
    ).join('');
  };

  const sorties = bottles.flatMap((b) => (b.sorties || []).map((s) => ({ ...s, nom: b.nom, millesime: b.millesime })))
    .sort((a, z) => z.date.localeCompare(a.date)).slice(0, 12);

  $('#contenu-stats').innerHTML = `
    <div class="bandeau-valeur" style="margin-bottom:18px">
      <div><div class="v">${nb}</div><div class="l">bouteilles</div></div>
      <div><div class="v">${Math.round(valeur)} €</div><div class="l">valeur cave</div></div>
      <div><div class="v">${enCave.length}</div><div class="l">références</div></div>
    </div>
    <div class="stat-bloc"><h3 class="sous-titre">Par couleur</h3>${jauges(parGroupe('couleur')) || '—'}</div>
    <div class="stat-bloc"><h3 class="sous-titre">Par région</h3>${jauges(parGroupe('region'))}</div>
    <div class="stat-bloc"><h3 class="sous-titre">Pyramide des millésimes</h3>${jauges(parGroupe('millesime').sort((a, z) => String(z[0]).localeCompare(String(a[0]))), true)}</div>
    <div class="stat-bloc"><h3 class="sous-titre">Dernières sorties</h3>
      ${sorties.map((s) => `<div class="journal-item"><span>🍷 ${esc(s.nom)} ${s.millesime || ''}${s.occasion ? ` — <i>${esc(s.occasion)}</i>` : ''}</span><span class="quand">${s.date}</span></div>`).join('') || '<p style="color:var(--creme-45);font-size:13px">Aucune sortie enregistrée.</p>'}
    </div>
    <div class="stat-bloc"><h3 class="sous-titre">Réglages</h3>
      <label style="font-size:12px;color:var(--creme-45)">Clé API Claude (optionnel — débloque photo + Sommelier+)</label>
      <input id="set-api" type="password" placeholder="sk-ant-…" value="${esc(settings.apiKey)}">
      <label style="display:flex;align-items:center;gap:10px;margin-top:12px;font-size:14px;color:var(--creme-70)">
        <input type="checkbox" id="set-voix" style="width:auto" ${settings.voixActive ? 'checked' : ''}> Le sommelier me répond à voix haute
      </label>
      <button class="btn-or" id="btn-save-settings">Enregistrer les réglages</button>
      <button class="btn-fantome" id="btn-installer" hidden>📲 Installer l'app sur ce téléphone</button>
      <div class="actions" style="margin-top:10px">
        <button class="btn-sombre" id="btn-export" style="flex:1">⬇️ Exporter</button>
        <button class="btn-sombre" id="btn-import" style="flex:1">⬆️ Importer</button>
        <input type="file" id="input-import" accept=".json" hidden>
      </div>
      <button class="btn-discret btn-danger" id="btn-vider" style="width:100%;margin-top:8px">Tout effacer</button>
    </div>`;

  $('#btn-save-settings').onclick = () => {
    store.majSettings({ apiKey: $('#set-api').value.trim(), voixActive: $('#set-voix').checked });
    toast('Réglages enregistrés'); rendreSommelierPlus();
  };
  $('#btn-export').onclick = () => {
    const blob = new Blob([store.exporter()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `caveau-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('Sauvegarde téléchargée');
  };
  $('#btn-import').onclick = () => $('#input-import').click();
  $('#input-import').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importer(await f.text()); rendreStats(); toast('Cave importée !'); }
    catch (err) { toast(`Import impossible : ${err.message}`); }
  };
  $('#btn-vider').onclick = () => {
    if (confirm('Vraiment tout effacer ? Pensez à exporter avant.')) { store.toutEffacer(); rendreStats(); toast('Cave réinitialisée'); }
  };

  // Bouton d'installation PWA
  if (window.__promptInstall) {
    const btn = $('#btn-installer');
    btn.hidden = false;
    btn.onclick = () => window.__promptInstall();
  }
}

/* ═══ Init ═══ */
export function initUI() {
  document.querySelectorAll('.nav-item').forEach((b) => b.onclick = () => montrerEcran(b.dataset.ecran));
  $('#voile').onclick = () => montrerFeuille(false);
  $('#recherche').oninput = rendreCave;
  initAjouter();
  initSommelier();
  initAlertes();

  const { bottles } = store.get();
  montrerEcran(bottles.length ? 'cave' : 'ajouter');
  if (!bottles.length) toast('Bienvenue ! Commencez par dicter ou écrire vos bouteilles 🍷');
}
