// Rendu des écrans et interactions. Toute la logique métier vit dans
// parser.js / sommelier.js / wine-data.js ; ici on ne fait qu'orchestrer.

import { store } from './store.js';
import { parseTexte, parseLigne, parseTexteSpirit, parseLigneSpirit } from './parser.js';
import { recommander, surprise, argumentaire } from './sommelier.js';
import { REGIONS, COULEURS, PAYS, FORMATS, TYPES_SPIRITUEUX, regionsPour, maturite, gardeParDefaut } from './wine-data.js';
import { dicter, parler, voixDisponible } from './voice.js';
import { analyserEtiquette, analyserEtiquetteSpirit, sommelierPlus, equivalents, enrichirBouteille, synthVoixGemini } from './ai.js';

// Fait parler le sommelier : belle voix Gemini si une clé Gemini est configurée,
// sinon repli sur la synthèse du navigateur.
function dire(texte) {
  const { voixActive, apiKey } = store.get().settings;
  parler(texte, voixActive, apiKey ? (t) => synthVoixGemini(apiKey, t) : null);
}

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ecranActif = 'cave';
let filtreCouleur = null;
let occasion = 'weekend';
let aAjouter = []; // bouteilles en attente de confirmation
let catCave = 'vin';
let catAjout = 'vin';
let filtreTypeSpirit = null;
let filtreOuvert = null; // null | 'ouverte' | 'fermee'

// Une bouteille de spiritueux est « ouverte » dès que son niveau est entamé
const estOuverte = (b) => b.niveau != null && b.niveau < 100;

// Le sommelier et la roulette ne piochent que dans les vins
const vinsSeuls = (bottles) => bottles.filter((b) => b.categorie !== 'spiritueux');

/* ═══ Voix du caveau : un peu de fantaisie ═══ */
const alea = (arr) => arr[Math.floor(Math.random() * arr.length)];
const PHRASES_AJOUT = [
  'Bouteille ajoutée à votre cave.',
  'Une pensionnaire de plus au caveau !',
  'Très belle pioche. Je la couche précieusement.',
  'C\'est noté ! Votre cave prend de la valeur.',
  'Entrée en cave. Elle y sera très bien.',
  'Adoptée ! Je veille sur elle désormais.',
  'Encore une merveille à l\'abri de la lumière.',
  'Elle rejoint ses sœurs dans la pénombre. Parfait.',
];
const PHRASES_AJOUT_LOT = [
  (n) => `${n} bouteilles ajoutées à votre cave.`,
  (n) => `Belle rentrée : ${n} flacons de plus au caveau !`,
  (n) => `${n} nouvelles pensionnaires. La cave se porte bien.`,
  (n) => `J'enregistre ${n} bouteilles. Quel arrivage !`,
];
const PHRASES_SORTIE = [
  'Excellent choix. Bonne dégustation !',
  'Grand moment en perspective. Santé !',
  'Servez-la à bonne température, elle le mérite.',
  'Elle quitte la cave la tête haute. Régalez-vous !',
  'Pensez à la carafer si elle est jeune. Santé !',
];

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

/* ═══ Sélecteurs réutilisables ═══ */
// Régions proposées = celles du pays choisi + régions déjà en cave pour ce
// pays + valeur courante, avec « ➕ Autre… » pour créer à la volée.
function optionsRegion(selection, pays) {
  const duPays = regionsPour(pays);
  const enCave = store.get().bottles
    .filter((b) => !pays || b.pays === pays).map((b) => b.region);
  const base = duPays.length ? [...duPays, ...enCave] : [...REGIONS, ...enCave];
  const connues = [...new Set([...base, selection])]
    .filter(Boolean).sort((a, z) => a.localeCompare(z, 'fr'));
  return connues.map((r) => `<option ${r === selection ? 'selected' : ''}>${esc(r)}</option>`).join('') +
    '<option value="__autre">➕ Autre région…</option>';
}
function optionsPays(selection) {
  const connus = [...new Set([...PAYS, ...store.get().bottles.map((b) => b.pays), selection])]
    .filter(Boolean).sort((a, z) => a.localeCompare(z, 'fr'));
  return connus.map((p) => `<option ${p === selection ? 'selected' : ''}>${esc(p)}</option>`).join('') +
    '<option value="__autre">➕ Autre pays…</option>';
}
// Branche les couples pays ↔ région d'un conteneur : « Autre… » crée une
// valeur libre, et changer le pays refiltre la liste des régions.
function brancherSelectsRegion(racine) {
  racine.querySelectorAll('select[data-region]').forEach((sel) => {
    sel.onchange = () => {
      if (sel.value !== '__autre') return;
      const nom = (prompt('Nom de la nouvelle région :') || '').trim();
      if (nom) {
        const opt = document.createElement('option');
        opt.textContent = nom; opt.selected = true;
        sel.insertBefore(opt, sel.querySelector('option[value="__autre"]'));
      } else sel.selectedIndex = 0;
    };
  });
  racine.querySelectorAll('select[data-pays]').forEach((sel) => {
    sel.onchange = () => {
      if (sel.value === '__autre') {
        const nom = (prompt('Nom du pays :') || '').trim();
        if (nom) {
          const opt = document.createElement('option');
          opt.textContent = nom; opt.selected = true;
          sel.insertBefore(opt, sel.querySelector('option[value="__autre"]'));
        } else sel.selectedIndex = 0;
      }
      // refiltre la liste des régions du même bloc
      const zone = sel.closest('.apercu') || sel.closest('.feuille') || racine;
      const selRegion = zone.querySelector('select[data-region]');
      if (selRegion) selRegion.innerHTML = optionsRegion(null, sel.value);
    };
  });
}
function optionsListe(liste, selection) {
  const tout = [...new Set([...liste, selection])].filter(Boolean);
  return tout.map((x) => `<option ${x === selection ? 'selected' : ''}>${esc(x)}</option>`).join('');
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
  const { bottles, settings } = store.get();
  const enCave = bottles.filter((b) => b.qty > 0 && (catCave === 'spiritueux') === (b.categorie === 'spiritueux'));
  const recherche = ($('#recherche').value || '').toLowerCase();

  const nb = enCave.reduce((s, b) => s + b.qty, 0);
  const valeur = enCave.reduce((s, b) => s + (b.prix || 0) * b.qty, 0);
  const valeurTxt = settings.valeurCachee ? '•••' : `${Math.round(valeur)} €`;
  const aBoire = enCave.filter((b) => b.categorie !== 'spiritueux' && ['apogee', 'urgent'].includes(maturite(b).code)).reduce((s, b) => s + b.qty, 0);
  $('#bandeau-valeur').innerHTML = `
    <div><div class="v">${nb}</div><div class="l">bouteilles</div></div>
    <div id="cellule-valeur" title="Toucher pour masquer/afficher"><div class="v">${valeurTxt}</div><div class="l">valeur ${settings.valeurCachee ? '👁' : ''}</div></div>
    ${catCave === 'vin' ? `<div><div class="v">${aBoire}</div><div class="l">à boire</div></div>` : `<div><div class="v">${enCave.length}</div><div class="l">références</div></div>`}`;
  $('#cellule-valeur').onclick = () => {
    store.majSettings({ valeurCachee: !store.get().settings.valeurCachee });
    rendreCave();
  };

  // Filtres : couleur pour les vins · type + ouverte/fermée pour les spiritueux
  if (catCave === 'vin') {
    $('#filtres-couleur').innerHTML = ['toutes', ...COULEURS].map((c) =>
      `<button class="puce ${((c === 'toutes' && !filtreCouleur) || c === filtreCouleur) ? 'actif' : ''}" data-c="${c}">${c === 'toutes' ? 'Toutes' : c}</button>`
    ).join('');
    $('#filtres-couleur').querySelectorAll('.puce').forEach((p) => p.onclick = () => {
      filtreCouleur = p.dataset.c === 'toutes' ? null : p.dataset.c;
      rendreCave();
    });
  } else {
    const typesPresents = [...new Set(enCave.map((b) => b.type || 'Autre'))].sort((a, z) => a.localeCompare(z, 'fr'));
    $('#filtres-couleur').innerHTML =
      `<button class="puce ${!filtreTypeSpirit ? 'actif' : ''}" data-t="__tous">Tous</button>` +
      typesPresents.map((t) => `<button class="puce ${filtreTypeSpirit === t ? 'actif' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('') +
      `<button class="puce ${filtreOuvert === 'ouverte' ? 'actif' : ''}" data-o="ouverte" style="margin-left:10px">🔓 Ouvertes</button>` +
      `<button class="puce ${filtreOuvert === 'fermee' ? 'actif' : ''}" data-o="fermee">🔒 Fermées</button>`;
    $('#filtres-couleur').querySelectorAll('[data-t]').forEach((p) => p.onclick = () => {
      filtreTypeSpirit = p.dataset.t === '__tous' ? null : p.dataset.t;
      rendreCave();
    });
    $('#filtres-couleur').querySelectorAll('[data-o]').forEach((p) => p.onclick = () => {
      filtreOuvert = filtreOuvert === p.dataset.o ? null : p.dataset.o;
      rendreCave();
    });
  }

  let visibles = enCave;
  if (catCave === 'vin' && filtreCouleur) visibles = visibles.filter((b) => b.couleur === filtreCouleur);
  if (catCave === 'spiritueux') {
    if (filtreTypeSpirit) visibles = visibles.filter((b) => (b.type || 'Autre') === filtreTypeSpirit);
    if (filtreOuvert === 'ouverte') visibles = visibles.filter(estOuverte);
    if (filtreOuvert === 'fermee') visibles = visibles.filter((b) => !estOuverte(b));
  }
  if (recherche) visibles = visibles.filter((b) =>
    `${b.nom} ${b.domaine || ''} ${b.appellation || ''} ${b.region || ''} ${b.type || ''} ${b.millesime || ''}`.toLowerCase().includes(recherche));

  if (!visibles.length) {
    const vide = catCave === 'vin' ? 'Votre cave est vide' : 'Aucun spiritueux pour l\'instant';
    $('#liste-cave').innerHTML = `<div class="vide"><div class="gros">${enCave.length ? 'Rien ne correspond' : vide}</div>${enCave.length ? '' : 'Passez par l\'onglet <b>Ajouter</b> — à la voix, c\'est encore mieux.'}</div>`;
    return;
  }

  // Vins groupés par région · spiritueux groupés par type
  const cle = catCave === 'vin' ? 'region' : 'type';
  const groupes = {};
  visibles.forEach((b) => (groupes[b[cle] || 'Autre'] ??= []).push(b));
  const groupesTries = Object.keys(groupes).sort((a, z) =>
    groupes[z].reduce((s, b) => s + b.qty, 0) - groupes[a].reduce((s, b) => s + b.qty, 0));

  $('#liste-cave').innerHTML = groupesTries.map((g) => {
    const liste = catCave === 'vin'
      ? groupes[g].sort((a, z) => maturite(a).ordre - maturite(z).ordre)
      : groupes[g].sort((a, z) => (a.nom || '').localeCompare(z.nom || ''));
    const nbG = liste.reduce((s, b) => s + b.qty, 0);
    return `<div class="groupe-region">${esc(g)} <small>${nbG} BTL</small></div>` +
      liste.map(carteHTML).join('');
  }).join('');

  $('#liste-cave').querySelectorAll('.carte').forEach((c) => c.onclick = () => ouvrirFiche(c.dataset.id));
}

function carteHTML(b) {
  if (b.categorie === 'spiritueux') {
    return `<div class="carte" data-id="${b.id}">
      <div class="carte-couleur c-spirit"></div>
      <div class="carte-corps">
        <div class="carte-nom">${esc([b.domaine, b.nom].filter(Boolean).join(' '))}</div>
        <div class="carte-meta">${esc(b.type || 'Spiritueux')}${b.age ? ` · ${b.age} ans` : ''}${b.alcool ? ` · ${b.alcool}%` : ''}${b.prix ? ` · ${b.prix} €` : ''}${b.noteWeb ? ` · <span class="note-viv">★ ${esc(b.noteWeb)}</span>` : ''}${b.maNote ? ` · <span class="note-moi">${b.maNote}/100</span>` : ''}</div>
        ${estOuverte(b) ? `<span class="cachet ${b.niveau <= 25 ? 'cachet-urgent' : 'cachet-approche'}">${b.niveau <= 25 ? '⚡ À finir' : '🔓 Ouverte'} · ${b.niveau} %</span>` : ''}
      </div>
      <div class="carte-fin"><div class="carte-qty">×<b>${b.qty}</b></div></div>
    </div>`;
  }
  const m = maturite(b);
  return `<div class="carte" data-id="${b.id}">
    <div class="carte-couleur c-${b.couleur}"></div>
    <div class="carte-corps">
      <div class="carte-nom">${esc(b.nom)} ${b.millesime ? `<span class="mil">${b.millesime}</span>` : ''}</div>
      <div class="carte-meta">${esc(b.appellation || b.region)}${b.prix ? ` · ${b.prix} €` : ''}${b.noteVivino ? ` · <span class="note-viv">★ ${String(b.noteVivino).replace('.', ',')}</span>` : ''}${b.maNote ? ` · <span class="note-moi">${b.maNote}/100</span>` : ''}</div>
      <span class="cachet cachet-${m.code}">${m.label}</span>
    </div>
    <div class="carte-fin"><div class="carte-qty">×<b>${b.qty}</b></div></div>
  </div>`;
}

/* ═══ Fiche bouteille (bottom sheet) ═══ */
function ouvrirFiche(id) {
  const b = store.get().bottles.find((x) => x.id === id);
  if (!b) return;
  if (b.categorie === 'spiritueux') { ouvrirFicheSpirit(b); return; }
  const m = maturite(b);
  $('#feuille').innerHTML = `
    <h3>${esc(b.nom)} ${b.millesime ? `<em style="color:var(--or-clair)">${b.millesime}</em>` : ''}</h3>
    <p style="color:var(--creme-45);font-size:13px;margin-top:4px">${esc(b.domaine || '')}
      <span class="cachet cachet-${m.code}">${m.label}</span>
      ${b.noteVivino ? `<span class="note-viv" style="margin-left:6px">★ ${String(b.noteVivino).replace('.', ',')}/5 Vivino</span>` : ''}
      ${b.gardeDe ? `<span style="margin-left:6px">garde ${b.gardeDe}–${b.gardeA}</span>` : ''}</p>
    <div class="ligne">
      <div style="flex:2"><label>Nom / cuvée</label><input id="f-nom" value="${esc(b.nom)}"></div>
      <div style="flex:1"><label>Millésime</label><input id="f-mil" type="number" value="${b.millesime || ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>Domaine / producteur</label><input id="f-domaine" value="${esc(b.domaine || '')}"></div>
      <div style="flex:1"><label>Appellation</label><input id="f-appellation" value="${esc(b.appellation || '')}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>Pays</label><select id="f-pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
      <div style="flex:1"><label>Région</label><select id="f-region" data-region>${optionsRegion(b.region, b.pays || 'France')}</select></div>
      <div style="flex:1"><label>Couleur</label><select id="f-couleur">${optionsListe(COULEURS, b.couleur)}</select></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>Prix (€)</label><input id="f-prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
      <div style="flex:1"><label>Quantité</label><input id="f-qty" type="number" min="0" value="${b.qty}"></div>
      <div style="flex:1"><label>Garde de</label><input id="f-gde" type="number" value="${b.gardeDe || ''}"></div>
      <div style="flex:1"><label>à</label><input id="f-gda" type="number" value="${b.gardeA || ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1.4"><label>Cépages</label><input id="f-cepages" value="${esc(Array.isArray(b.cepages) ? b.cepages.join(', ') : (b.cepages || ''))}"></div>
      <div style="flex:1"><label>Format</label><select id="f-format">${optionsListe(FORMATS, b.format || '75 cl')}</select></div>
      <div style="flex:.7"><label>% vol</label><input id="f-alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
    </div>
    ${b.description ? `<div class="bulle-ia" style="margin-top:10px;font-size:13px">📜 ${esc(b.description)}</div>` : ''}
    <h4 class="sous-titre" style="margin:14px 0 6px;font-size:17px">Mon avis</h4>
    <div class="ligne" style="align-items:flex-end;margin-top:0">
      <div style="flex:.6"><label>Ma note /100</label><input id="f-manote" type="number" min="1" max="100" value="${b.maNote ?? ''}" placeholder="—"></div>
      <div style="flex:2"><label>Mes notes de dégustation</label><textarea id="f-notes" rows="2" placeholder="Dictez ou écrivez vos impressions…">${esc(b.notes || '')}</textarea></div>
      <button class="micro micro-mini" id="f-micro-notes" aria-label="Dicter mes notes" style="height:46px">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
      </button>
    </div>
    <div class="actions">
      <button class="btn-or" id="f-sortir" style="flex:1.4">🍷 Je la sors</button>
      <button class="btn-sombre" id="f-save" style="flex:1">Enregistrer</button>
    </div>
    <div class="liens-rachat" style="margin-top:14px">${liensRachatHTML(b)}</div>
    <div id="f-equiv"></div>
    ${store.get().settings.apiKey ? '<button class="btn-fantome" id="f-btn-equiv">✨ Trouver des équivalents (IA)</button>' : ''}
    <button class="btn-discret btn-danger" id="f-suppr" style="width:100%;margin-top:8px">Supprimer cette référence</button>`;
  montrerFeuille(true);

  brancherSelectsRegion($('#feuille'));
  $('#f-save').onclick = () => {
    store.majBouteille(id, {
      nom: $('#f-nom').value.trim() || b.nom,
      millesime: parseInt($('#f-mil').value) || null,
      domaine: $('#f-domaine').value.trim(),
      appellation: $('#f-appellation').value.trim() || null,
      pays: $('#f-pays').value, region: $('#f-region').value, couleur: $('#f-couleur').value,
      cepages: $('#f-cepages').value.trim() || null,
      format: $('#f-format').value,
      alcool: parseFloat($('#f-alcool').value) || null,
      prix: parseFloat($('#f-prix').value) || null,
      qty: Math.max(0, parseInt($('#f-qty').value) || 0),
      gardeDe: parseInt($('#f-gde').value) || null, gardeA: parseInt($('#f-gda').value) || null,
      maNote: Math.min(100, Math.max(1, parseInt($('#f-manote').value))) || null,
      notes: $('#f-notes').value,
    });
    montrerFeuille(false); rendre(ecranActif); toast('Fiche mise à jour');
  };
  if (!voixDisponible) $('#f-micro-notes').style.display = 'none';
  $('#f-micro-notes').onclick = () => {
    $('#f-micro-notes').classList.add('ecoute');
    const avant = $('#f-notes').value;
    dicter({
      onResult: (txt) => { $('#f-notes').value = (avant ? avant + ' ' : '') + txt; },
      onEnd: () => $('#f-micro-notes').classList.remove('ecoute'),
      onError: (msg) => toast(msg),
    });
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

function ouvrirFicheSpirit(b) {
  const id = b.id;
  $('#feuille').innerHTML = `
    <h3>${esc([b.domaine, b.nom].filter(Boolean).join(' '))}</h3>
    <p style="color:var(--creme-45);font-size:13px;margin-top:4px">${esc(b.type || 'Spiritueux')}
      ${b.noteWeb ? `<span class="note-viv" style="margin-left:6px">★ ${esc(b.noteWeb)}</span>` : ''}</p>
    <div class="ligne">
      <div style="flex:1"><label>Type</label><select id="f-type">${optionsListe(TYPES_SPIRITUEUX, b.type || 'Autre')}</select></div>
      <div style="flex:1.3"><label>Marque / distillerie</label><input id="f-domaine" value="${esc(b.domaine || '')}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1.6"><label>Nom / expression</label><input id="f-nom" value="${esc(b.nom || '')}"></div>
      <div style="flex:.7"><label>Âge (ans)</label><input id="f-age" type="number" min="0" value="${b.age ?? ''}"></div>
      <div style="flex:.7"><label>% vol</label><input id="f-alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>Pays</label><select id="f-pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
      <div style="flex:.8"><label>Format</label><select id="f-format">${optionsListe(FORMATS, b.format || '75 cl')}</select></div>
      <div style="flex:.7"><label>Prix (€)</label><input id="f-prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
      <div style="flex:.7"><label>Qté</label><input id="f-qty" type="number" min="0" value="${b.qty}"></div>
    </div>
    <div class="bloc-niveau">
      <label>Niveau restant : <b id="f-niveau-val">${b.niveau ?? 100} %</b><span id="f-niveau-alerte" style="color:var(--rouge-vif)">${(b.niveau ?? 100) <= 25 ? ' — à finir en priorité !' : ''}</span></label>
      <input id="f-niveau" type="range" min="0" max="100" step="5" value="${b.niveau ?? 100}">
    </div>
    ${b.description ? `<div class="bulle-ia" style="margin-top:10px;font-size:13px">📜 ${esc(b.description)}</div>` : ''}
    <h4 class="sous-titre" style="margin:14px 0 6px;font-size:17px">Mon avis</h4>
    <div class="ligne" style="align-items:flex-end;margin-top:0">
      <div style="flex:.6"><label>Ma note /100</label><input id="f-manote" type="number" min="1" max="100" value="${b.maNote ?? ''}" placeholder="—"></div>
      <div style="flex:2"><label>Mes notes de dégustation</label><textarea id="f-notes" rows="2" placeholder="Dictez ou écrivez vos impressions…">${esc(b.notes || '')}</textarea></div>
      <button class="micro micro-mini" id="f-micro-notes" aria-label="Dicter mes notes" style="height:46px">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
      </button>
    </div>
    <div class="actions">
      <button class="btn-or" id="f-sortir" style="flex:1.4">🥃 Je le sors de mon bar</button>
      <button class="btn-sombre" id="f-save" style="flex:1">Enregistrer</button>
    </div>
    <div class="liens-rachat" style="margin-top:14px">${liensRachatHTML(b)}</div>
    <button class="btn-discret btn-danger" id="f-suppr" style="width:100%;margin-top:8px">Supprimer cette référence</button>`;
  montrerFeuille(true);
  brancherSelectsRegion($('#feuille'));

  $('#f-save').onclick = () => {
    store.majBouteille(id, {
      type: $('#f-type').value,
      domaine: $('#f-domaine').value.trim(),
      nom: $('#f-nom').value.trim() || b.nom,
      age: parseInt($('#f-age').value) || null,
      alcool: parseFloat($('#f-alcool').value) || null,
      pays: $('#f-pays').value,
      format: $('#f-format').value,
      prix: parseFloat($('#f-prix').value) || null,
      qty: Math.max(0, parseInt($('#f-qty').value) || 0),
      niveau: parseInt($('#f-niveau').value),
      maNote: Math.min(100, Math.max(1, parseInt($('#f-manote').value))) || null,
      notes: $('#f-notes').value,
    });
    montrerFeuille(false); rendre(ecranActif); toast('Fiche mise à jour');
  };
  $('#f-niveau').oninput = () => {
    const v = parseInt($('#f-niveau').value);
    $('#f-niveau-val').textContent = `${v} %`;
    $('#f-niveau-alerte').textContent = v <= 25 && v > 0 ? ' — à finir en priorité !' : '';
  };
  // Le niveau s'enregistre tout seul dès qu'on lâche le curseur
  $('#f-niveau').onchange = () => {
    store.majBouteille(id, { niveau: parseInt($('#f-niveau').value) });
    rendreCave(); majBadgeAlertes();
  };
  $('#f-sortir').onclick = () => {
    store.sortirBouteille(id, '', '');
    montrerFeuille(false); rendre(ecranActif);
    const restant = store.get().bottles.find((x) => x.id === id)?.qty ?? 0;
    toast(restant > 0 ? `Sortie du bar. Il en reste ${restant}.` : 'Dernière bouteille sortie du bar — pensez au rachat 😉');
  };
  $('#f-suppr').onclick = () => {
    if (confirm(`Supprimer « ${b.nom} » ?`)) {
      store.supprimerBouteille(id); montrerFeuille(false); rendre(ecranActif); toast('Référence supprimée');
    }
  };
  if (!voixDisponible) $('#f-micro-notes').style.display = 'none';
  $('#f-micro-notes').onclick = () => {
    $('#f-micro-notes').classList.add('ecoute');
    const avant = $('#f-notes').value;
    dicter({
      onResult: (txt) => { $('#f-notes').value = (avant ? avant + ' ' : '') + txt; },
      onEnd: () => $('#f-micro-notes').classList.remove('ecoute'),
      onError: (msg) => toast(msg),
    });
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
    dire(restant > 0 ? alea(PHRASES_SORTIE) : 'C\'était la dernière bouteille. Je la note pour le rachat !');
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
  const aideMicro = () => catAjout === 'spiritueux'
    ? 'Touchez et dictez : « une bouteille de whisky Lagavulin seize ans, quatre-vingts euros »'
    : 'Touchez et dictez : « deux bouteilles de Chinon 2020, quinze euros »';
  // Texte, voix, photo et fiche (formulaire) sont disponibles pour les vins
  // comme pour les spiritueux — le formulaire affiché dépend de la catégorie.
  const montrerModes = () => {
    $('#modes-ajout [data-mode="forme"]').hidden = false;
    const actif = $('#modes-ajout .seg.actif')?.dataset.mode || 'texte';
    ['texte', 'voix', 'photo'].forEach((m) => { $(`#panneau-${m}`).hidden = m !== actif; });
    $('#panneau-spiritueux').hidden = !(catAjout === 'spiritueux' && actif === 'forme');
    $('#panneau-fiche-vin').hidden = !(catAjout === 'vin' && actif === 'forme');
    $('#saisie-texte').placeholder = catAjout === 'spiritueux'
      ? 'Ex : Ardbeg Uigeadail whisky 54,2%, 80€\n2 bouteilles de rhum Clément XO\nGin Monkey 47, 45€'
      : 'Ex : 3 bouteilles de Gevrey-Chambertin 2019 domaine Dugat, 65€\nSancerre blanc 2022, 18 euros\nChampagne Bollinger, x2';
    $('#micro-aide').textContent = aideMicro();
  };
  $('#categorie-ajout').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    catAjout = s.dataset.cat;
    $('#categorie-ajout').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
    aAjouter = []; $('#apercu-ajout').innerHTML = '';
    montrerModes();
  });
  $('#modes-ajout').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    $('#modes-ajout').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
    montrerModes();
  });
  if (!voixDisponible) $('#modes-ajout [data-mode="voix"]').style.display = 'none';
  const rendreApercuCourant = () => catAjout === 'spiritueux' ? rendreApercuSpirit() : rendreApercu();

  // Formulaire vin
  $('#fv-pays').innerHTML = optionsPays('France');
  $('#fv-region').innerHTML = optionsRegion('Bordeaux', 'France');
  $('#fv-couleur').innerHTML = optionsListe(COULEURS, 'rouge');
  brancherSelectsRegion($('#panneau-fiche-vin'));
  $('#btn-analyser-fiche-vin').onclick = () => {
    const nom = $('#fv-nom').value.trim();
    const appellation = $('#fv-appellation').value.trim();
    if (!nom && !appellation) return toast('Indiquez au moins le nom ou l\'appellation');
    const millesime = parseInt($('#fv-mil').value) || null;
    const region = $('#fv-region').value;
    const couleur = $('#fv-couleur').value;
    aAjouter = [{
      nom: nom || appellation,
      domaine: $('#fv-domaine').value.trim(),
      appellation: appellation || null,
      pays: $('#fv-pays').value, region, couleur, millesime,
      prix: parseFloat($('#fv-prix').value) || null,
      qty: parseInt($('#fv-qty').value) || 1,
      ...gardeParDefaut(region, couleur, millesime),
    }];
    rendreApercu();
  };

  // Formulaire spiritueux
  $('#sp-type').innerHTML = optionsListe(TYPES_SPIRITUEUX, 'Whisky');
  $('#sp-pays').innerHTML = optionsPays('France');
  $('#btn-analyser-spirit').onclick = () => {
    const marque = $('#sp-marque').value.trim();
    const nom = $('#sp-nom').value.trim();
    if (!marque && !nom) return toast('Indiquez au moins la marque ou le nom');
    aAjouter = [{
      categorie: 'spiritueux',
      type: $('#sp-type').value, domaine: marque, nom: nom || $('#sp-type').value,
      age: parseInt($('#sp-age').value) || null,
      alcool: parseFloat($('#sp-alcool').value) || null,
      pays: $('#sp-pays').value, format: '75 cl',
      prix: parseFloat($('#sp-prix').value) || null,
      qty: parseInt($('#sp-qty').value) || 1,
    }];
    rendreApercuSpirit();
  };

  $('#btn-analyser-texte').onclick = () => {
    const t = $('#saisie-texte').value.trim();
    if (!t) return toast('Décrivez d\'abord vos bouteilles');
    aAjouter = catAjout === 'spiritueux' ? parseTexteSpirit(t) : parseTexte(t);
    rendreApercuCourant();
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
        if (final) { aAjouter = catAjout === 'spiritueux' ? parseTexteSpirit(txt) : parseTexte(txt); rendreApercuCourant(); }
      },
      onEnd: () => { rec = null; $('#btn-micro').classList.remove('ecoute'); $('#micro-aide').textContent = aideMicro(); },
      onError: (msg) => { toast(msg); },
    });
  };

  // Photos — par lot (jusqu'à 10 étiquettes d'un coup)
  $('#input-photo').onchange = async (e) => {
    const fichiers = [...e.target.files].slice(0, 10);
    if (!fichiers.length) return;
    if (e.target.files.length > 10) toast('Maximum 10 photos à la fois — les premières sont traitées');
    const { apiKey } = store.get().settings;
    const spirit = catAjout === 'spiritueux';
    if (!apiKey) {
      $('#note-photo-ia').textContent = 'Astuce : ajoutez une clé IA (Gemini ou Claude) dans Stats → Réglages pour la lecture automatique d\'étiquettes. En attendant, fiches manuelles pré-créées.';
      const depuisNom = (f) => f.name.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' ');
      aAjouter = fichiers.map((f) => spirit ? parseLigneSpirit(depuisNom(f)) : parseLigne(depuisNom(f)));
      rendreApercuCourant();
      e.target.value = '';
      return;
    }
    aAjouter = [];
    const lus = [];
    for (let i = 0; i < fichiers.length; i++) {
      $('#note-photo-ia').textContent = `👁️ Lecture des étiquettes… ${i + 1} / ${fichiers.length}`;
      try {
        const { base64, type } = await compresser(fichiers[i]);
        if (spirit) {
          const r = await analyserEtiquetteSpirit(apiKey, base64, type);
          lus.push({
            categorie: 'spiritueux',
            type: TYPES_SPIRITUEUX.includes(r.type) ? r.type : 'Autre',
            domaine: r.marque || '', nom: r.nom || r.type || 'Spiritueux',
            age: r.age || null, alcool: r.alcool || null,
            pays: r.pays || null, format: '75 cl', prix: null, qty: 1,
          });
        } else {
          const r = await analyserEtiquette(apiKey, base64, type);
          const region = REGIONS.includes(r.region) ? r.region : (r.region || 'Monde');
          const g = gardeParDefaut(region, r.couleur || 'rouge', r.millesime);
          lus.push({
            nom: r.nom || 'Vin', domaine: r.domaine || '', appellation: r.appellation || null,
            pays: r.pays || null, region,
            couleur: COULEURS.includes(r.couleur) ? r.couleur : 'rouge',
            millesime: r.millesime || null,
            cepages: Array.isArray(r.cepages) ? r.cepages.join(', ') : (r.cepages || null),
            alcool: r.alcool || null, prix: null, qty: 1, ...g,
          });
        }
      } catch (err) {
        toast(`Photo ${i + 1} illisible (${err.message}) — fiche vide à compléter`);
        lus.push(spirit ? parseLigneSpirit('Spiritueux à identifier') : parseLigne('Vin à identifier'));
      }
    }
    $('#note-photo-ia').textContent = '';
    aAjouter = lus;
    rendreApercuCourant();
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

// Retire une fiche de l'aperçu sans toucher aux autres (tombstone) :
// l'entrée passe à null, sa carte disparaît, le compteur se met à jour.
function brancherSuppression() {
  $('#apercu-ajout').querySelectorAll('[data-rm]').forEach((btn) => btn.onclick = () => {
    aAjouter[+btn.dataset.rm] = null;
    btn.closest('.apercu').remove();
    const reste = aAjouter.filter(Boolean).length;
    if (!reste) { aAjouter = []; $('#apercu-ajout').innerHTML = ''; return; }
    const valid = $('#btn-confirmer-ajout');
    if (valid) valid.textContent = `✓ Valider l'entrée${catAjout === 'spiritueux' ? '' : ' en cave'} (${reste})`;
  });
}

function rendreApercu() {
  if (!aAjouter.length) { $('#apercu-ajout').innerHTML = ''; return; }
  $('#apercu-ajout').innerHTML = aAjouter.map((b, i) => `
    <div class="apercu" data-i="${i}">
      <div class="apercu-tete"><h4>🍾 Bouteille ${aAjouter.length > 1 ? i + 1 : 'détectée'}</h4><button class="apercu-suppr" data-rm="${i}" title="Ne pas ajouter cette bouteille">✕ Retirer</button></div>
      <div class="ligne">
        <div style="flex:2"><label>Nom / cuvée</label><input data-k="nom" value="${esc(b.nom)}"></div>
        <div style="flex:.8"><label>Millésime</label><input data-k="millesime" type="number" value="${b.millesime || ''}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>Domaine / producteur</label><input data-k="domaine" value="${esc(b.domaine || '')}"></div>
        <div style="flex:1"><label>Appellation</label><input data-k="appellation" value="${esc(b.appellation || '')}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>Pays</label><select data-k="pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
        <div style="flex:1"><label>Région</label><select data-k="region" data-region>${optionsRegion(b.region, b.pays || 'France')}</select></div>
        <div style="flex:1"><label>Couleur</label><select data-k="couleur">${optionsListe(COULEURS, b.couleur)}</select></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>Prix (€)</label><input data-k="prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
        <div style="flex:1"><label>Quantité</label><input data-k="qty" type="number" min="1" value="${b.qty}"></div>
      </div>
      <details class="plus-details">
        <summary>Plus de détails (cépages, format, degré…)</summary>
        <div class="ligne">
          <div style="flex:1.4"><label>Cépages</label><input data-k="cepages" value="${esc(Array.isArray(b.cepages) ? b.cepages.join(', ') : (b.cepages || ''))}" placeholder="grenache, syrah…"></div>
          <div style="flex:1"><label>Format</label><select data-k="format">${optionsListe(FORMATS, b.format || '75 cl')}</select></div>
          <div style="flex:.7"><label>% vol</label><input data-k="alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
        </div>
      </details>
      <p class="statut-enrich">${esc(b.prixInfo || '')}</p>
      <div class="ligne"><div style="flex:1"><label>Fiche du vin</label><textarea data-k="description" rows="3" placeholder="Description, arômes, accords… (remplie automatiquement si clé IA)">${esc(b.description || '')}</textarea></div></div>
    </div>`).join('') +
    `<p class="note-ia" style="text-align:left;margin:10px 2px 0">🧐 <b>Relisez et corrigez</b> avant de valider — rien n'entre en cave sans votre accord.</p>
    <button class="btn-or btn-large" id="btn-confirmer-ajout">✓ Valider l'entrée en cave (${aAjouter.length})</button>`;
  brancherSelectsRegion($('#apercu-ajout'));
  brancherSuppression();
  enrichirApercu();

  $('#btn-confirmer-ajout').onclick = confirmerAjout;
}

// Aperçu de validation d'un spiritueux (champs adaptés, même enrichissement web)
function rendreApercuSpirit() {
  if (!aAjouter.length) { $('#apercu-ajout').innerHTML = ''; return; }
  $('#apercu-ajout').innerHTML = aAjouter.map((b, i) => `
    <div class="apercu" data-i="${i}">
      <div class="apercu-tete"><h4>🥃 Spiritueux ${aAjouter.length > 1 ? i + 1 : 'détecté'}</h4><button class="apercu-suppr" data-rm="${i}" title="Ne pas ajouter ce spiritueux">✕ Retirer</button></div>
      <div class="ligne">
        <div style="flex:1"><label>Type</label><select data-k="type">${optionsListe(TYPES_SPIRITUEUX, b.type)}</select></div>
        <div style="flex:1.3"><label>Marque / distillerie</label><input data-k="domaine" value="${esc(b.domaine || '')}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1.6"><label>Nom / expression</label><input data-k="nom" value="${esc(b.nom || '')}"></div>
        <div style="flex:.7"><label>Âge</label><input data-k="age" type="number" min="0" value="${b.age ?? ''}"></div>
        <div style="flex:.7"><label>% vol</label><input data-k="alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>Pays</label><select data-k="pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
        <div style="flex:.8"><label>Prix (€)</label><input data-k="prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
        <div style="flex:.7"><label>Qté</label><input data-k="qty" type="number" min="1" value="${b.qty}"></div>
      </div>
      <div class="bloc-niveau">
        <label>Niveau restant : <b class="niveau-val">${b.niveau ?? 100} %</b> <small style="color:var(--creme-45)">(déjà ouverte ? ajustez)</small></label>
        <input data-k="niveau" type="range" min="0" max="100" step="5" value="${b.niveau ?? 100}">
      </div>
      <p class="statut-enrich">${esc(b.prixInfo || '')}</p>
      <div class="ligne"><div style="flex:1"><label>Fiche</label><textarea data-k="description" rows="3" placeholder="Distillerie, profil aromatique… (remplie automatiquement si clé IA)">${esc(b.description || '')}</textarea></div></div>
    </div>`).join('') +
    `<p class="note-ia" style="text-align:left;margin:10px 2px 0">🧐 <b>Relisez et corrigez</b> avant de valider — rien n'entre en cave sans votre accord.</p>
    <button class="btn-or btn-large" id="btn-confirmer-ajout">✓ Valider l'entrée (${aAjouter.length})</button>`;
  brancherSelectsRegion($('#apercu-ajout'));
  brancherSuppression();
  $('#apercu-ajout').querySelectorAll('[data-k="niveau"]').forEach((r) => r.oninput = () => {
    r.closest('.bloc-niveau').querySelector('.niveau-val').textContent = `${r.value} %`;
  });
  enrichirApercu();
  $('#btn-confirmer-ajout').onclick = confirmerAjout;
}

// Recherche web (prix + fiche) bouteille par bouteille, sans bloquer l'édition.
// Ne touche jamais un champ déjà rempli par l'utilisateur.
async function enrichirApercu() {
  const { apiKey } = store.get().settings;
  if (!apiKey) return;
  const lot = aAjouter; // si l'utilisateur relance une analyse, on abandonne ce lot
  for (let i = 0; i < lot.length; i++) {
    if (lot !== aAjouter) return;
    const b = lot[i];
    if (!b || b.description) continue; // fiche retirée ou déjà enrichie
    const carte = () => document.querySelector(`.apercu[data-i="${i}"]`);
    const statut = (txt) => { const el = carte()?.querySelector('.statut-enrich'); if (el) el.textContent = txt; };
    statut('🔎 Recherche du prix et de la fiche sur le web…');
    try {
      const r = await enrichirBouteille(apiKey, b);
      if (lot !== aAjouter) return;
      b.description = r.description; b.prixInfo = r.prixInfo;
      if (r.noteVivino != null) b.noteVivino = r.noteVivino;
      if (r.noteWeb != null) b.noteWeb = r.noteWeb;
      const el = carte();
      if (el) {
        const prixInput = el.querySelector('[data-k="prix"]');
        if (r.prix != null && prixInput && prixInput.value === '') { prixInput.value = r.prix; b.prix = r.prix; }
        // Complète les champs d'identité trouvés sur le web — jamais ceux déjà remplis
        for (const k of ['pays', 'appellation', 'domaine', 'cepages', 'alcool']) {
          const inp = el.querySelector(`[data-k="${k}"]`);
          if (r[k] != null && inp && !inp.value) {
            if (inp.tagName === 'SELECT' && ![...inp.options].some((o) => o.value === String(r[k]))) continue;
            inp.value = r[k]; b[k] = r[k];
          }
        }
        const desc = el.querySelector('[data-k="description"]');
        if (desc && !desc.value) desc.value = r.description || '';
        const note = b.categorie === 'spiritueux'
          ? (r.noteWeb ? ` · ★ ${r.noteWeb}` : ' · note communautaire introuvable')
          : (r.noteVivino ? ` · ★ ${String(r.noteVivino).replace('.', ',')}/5 sur Vivino` : ' · note Vivino introuvable');
        statut(`${r.prix != null ? '✅' : '⚠️'} ${r.prixInfo}${note}${r.generique ? ' · fiche générique d\'appellation' : ''}`);
      }
    } catch (e) {
      statut(`⚠️ Recherche web impossible (${e.message})`);
    }
  }
}

function confirmerAjout() {
  const ajoutees = [];
  document.querySelectorAll('.apercu').forEach((el) => {
    const b = aAjouter[+el.dataset.i];
    el.querySelectorAll('[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      b[k] = inp.type === 'range' ? parseInt(inp.value)
        : inp.type === 'number' ? (parseFloat(inp.value) || (k === 'qty' ? 1 : null))
        : inp.value;
    });
    if (b.categorie !== 'spiritueux') {
      // recalcule la garde si région/millésime ont changé
      const g = gardeParDefaut(b.region, b.couleur, b.millesime);
      b.gardeDe = b.gardeDe || g.gardeDe; b.gardeA = b.gardeA || g.gardeA;
    }
    ajoutees.push(store.ajouterBouteille(b));
  });
  const n = ajoutees.length;
  aAjouter = [];
  $('#apercu-ajout').innerHTML = '';
  $('#saisie-texte').value = ''; $('#transcript-ajout').textContent = '';
  toast(`${n} ${n > 1 ? 'entrées' : 'entrée'} en cave. Santé !`);
  dire(n > 1 ? alea(PHRASES_AJOUT_LOT)(n) : alea(PHRASES_AJOUT));
  majBadgeAlertes();
  // Si on a validé avant la fin de la recherche web, elle continue en
  // arrière-plan et complète les fiches directement en cave.
  ajoutees.filter((b) => !b.description).forEach((b) => enrichirEnCave(b.id));
}

// Enrichissement différé d'une bouteille déjà en cave (validation rapide).
async function enrichirEnCave(id) {
  const { apiKey } = store.get().settings;
  const b = store.get().bottles.find((x) => x.id === id);
  if (!apiKey || !b || b.description) return;
  try {
    const r = await enrichirBouteille(apiKey, b);
    const courant = store.get().bottles.find((x) => x.id === id);
    if (!courant) return; // supprimée entre-temps
    const patch = { description: r.description, prixInfo: r.prixInfo };
    if (r.prix != null && courant.prix == null) patch.prix = r.prix;
    if (r.noteVivino != null) patch.noteVivino = r.noteVivino;
    if (r.noteWeb != null) patch.noteWeb = r.noteWeb;
    for (const k of ['pays', 'appellation', 'domaine', 'cepages', 'alcool']) {
      if (r[k] != null && !courant[k]) patch[k] = r[k];
    }
    store.majBouteille(id, patch);
    if (ecranActif === 'cave') rendreCave();
    toast(`📜 Fiche complétée : ${[courant.domaine, courant.nom].filter(Boolean).join(' ')}`);
  } catch (e) {
    console.warn('Enrichissement différé impossible', e);
  }
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
    const enCave = vinsSeuls(store.get().bottles).filter((b) => b.qty > 0);
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
    dire(argumentaire(choix[0], profil));
  };

  $('#btn-surprise').onclick = () => {
    const enCave = vinsSeuls(store.get().bottles).filter((b) => b.qty > 0);
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
    dire(`Ce soir, je vous propose le ${b.nom} ${b.millesime || ''}.`);
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
      dire(rep);
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
  const urgentes = bottles.filter((b) => b.categorie !== 'spiritueux' && b.qty > 0 && maturite(b).code === 'urgent');
  const aFinir = bottles.filter((b) => b.categorie === 'spiritueux' && b.qty > 0 && b.niveau != null && b.niveau > 0 && b.niveau <= 25);
  const epuisees = bottles.filter((b) => b.qty === 0 && (b.sorties || []).length > 0).slice(-5);
  return { basses, urgentes, aFinir, epuisees };
}

function majBadgeAlertes() {
  const { basses, urgentes, aFinir } = alertesActuelles();
  const n = basses.length + urgentes.length + aFinir.length;
  const badge = $('#badge-alertes');
  badge.hidden = n === 0;
  badge.textContent = n;
}

function rendreAlertes() {
  const { bottles } = store.get();
  const { basses, urgentes, aFinir, epuisees } = alertesActuelles();
  let html = '';

  if (!basses.length && !urgentes.length && !aFinir.length && !epuisees.length) {
    html = '<div class="vide"><div class="gros">Tout va bien à la cave</div>Créez des veilles ci-dessous pour être prévenu quand un segment s\'épuise.</div>';
  }
  aFinir.forEach((b) => {
    html += `<div class="alerte"><div>🥃</div><div style="flex:1">
      <div class="alerte-titre">À finir en priorité : ${esc([b.domaine, b.nom].filter(Boolean).join(' '))}</div>
      <div class="alerte-detail">Il ne reste que ${b.niveau} % de la bouteille — un spiritueux ouvert s'oxyde, finissez-la avant d'en ouvrir une autre.</div>
    </div></div>`;
  });
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
  const vins = enCave.filter((b) => b.categorie !== 'spiritueux');
  const spirits = enCave.filter((b) => b.categorie === 'spiritueux');
  const valeur = enCave.reduce((s, b) => s + (b.prix || 0) * b.qty, 0);
  const valeurTxt = settings.valeurCachee ? '•••' : `${Math.round(valeur)} €`;
  const nb = enCave.reduce((s, b) => s + b.qty, 0);

  const parGroupe = (liste, cle) => {
    const g = {};
    liste.forEach((b) => { g[b[cle] || '—'] = (g[b[cle] || '—'] || 0) + b.qty; });
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
      <div id="cellule-valeur-stats" title="Toucher pour masquer/afficher"><div class="v">${valeurTxt}</div><div class="l">valeur cave ${settings.valeurCachee ? '👁' : ''}</div></div>
      <div><div class="v">${enCave.length}</div><div class="l">références</div></div>
    </div>
    <div class="stat-bloc"><h3 class="sous-titre">Par couleur</h3>${jauges(parGroupe(vins, 'couleur')) || '—'}</div>
    <div class="stat-bloc"><h3 class="sous-titre">Par région</h3>${jauges(parGroupe(vins, 'region'))}</div>
    <div class="stat-bloc"><h3 class="sous-titre">Pyramide des millésimes</h3>${jauges(parGroupe(vins, 'millesime').sort((a, z) => String(z[0]).localeCompare(String(a[0]))), true)}</div>
    ${spirits.length ? `<div class="stat-bloc"><h3 class="sous-titre">Spiritueux par type</h3>${jauges(parGroupe(spirits, 'type'))}</div>` : ''}
    <div class="stat-bloc"><h3 class="sous-titre">Dernières sorties</h3>
      ${sorties.map((s) => `<div class="journal-item"><span>🍷 ${esc(s.nom)} ${s.millesime || ''}${s.occasion ? ` — <i>${esc(s.occasion)}</i>` : ''}</span><span class="quand">${s.date}</span></div>`).join('') || '<p style="color:var(--creme-45);font-size:13px">Aucune sortie enregistrée.</p>'}
    </div>
    <div class="stat-bloc"><h3 class="sous-titre">Réglages</h3>
      <label style="font-size:12px;color:var(--creme-45)">Clé API IA — Gemini ou Claude (débloque photo, prix &amp; fiches web, Sommelier+)</label>
      <input id="set-api" type="password" placeholder="AQ.… / AIza… / sk-ant-…" value="${esc(settings.apiKey)}">
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

  $('#cellule-valeur-stats').onclick = () => {
    store.majSettings({ valeurCachee: !store.get().settings.valeurCachee });
    rendreStats();
  };
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
  $('#categorie-cave').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    catCave = s.dataset.cat;
    $('#categorie-cave').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
    rendreCave();
  });
  initAjouter();
  initSommelier();
  initAlertes();

  const { bottles } = store.get();
  montrerEcran(bottles.length ? 'cave' : 'ajouter');
  if (!bottles.length) toast('Bienvenue ! Commencez par dicter ou écrire vos bouteilles 🍷');
}
