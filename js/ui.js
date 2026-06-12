// Rendu des écrans et interactions. Toute la logique métier vit dans
// parser.js / sommelier.js / wine-data.js ; ici on ne fait qu'orchestrer.

import { store } from './store.js';
import { parseTexte, parseLigne, parseTexteSpirit, parseLigneSpirit } from './parser.js';
import { recommander, surprise, argumentaire, pctAccord } from './sommelier.js';
import { creerOrbe } from './orbe-fluide.js';
import { REGIONS, COULEURS, PAYS, FORMATS, TYPES_SPIRITUEUX, regionsPour, maturite, gardeParDefaut } from './wine-data.js';
import { dicter, parler, voixDisponible } from './voice.js';
import { analyserEtiquette, analyserEtiquetteSpirit, sommelierPlus, equivalents, enrichirBouteille, synthVoixGemini, genererImageBouteille, argumenterRecos } from './ai.js';
import { vibrer, transitionEcran } from './fx.js';
import { t, getLang } from './i18n.js';

// Fait parler le sommelier : belle voix Gemini si une clé Gemini est configurée,
// sinon repli sur la synthèse du navigateur. Pendant la lecture, l'encre
// du Sommelier « articule » (état parle), puis se rendort.
// promisePrefetch : Promise<Blob> déjà lancée (pré-chauffe Gemini) ou null.
async function dire(texte, promisePrefetch = null) {
  const { voixActive, apiKey } = store.get().settings;
  if (!voixActive) return;
  const anime = ecranActif === 'sommelier' && orbe;
  if (anime) orbe.etatVers('parle');
  const synth = promisePrefetch ? () => promisePrefetch : (apiKey ? (t) => synthVoixGemini(apiKey, t) : null);
  try {
    await parler(texte, true, synth);
  } finally {
    if (anime && orbe.etat === 'parle') orbe.etatVers('repos');
  }
}

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ═══ Icônes SVG au trait — remplacent les émojis (rendu net, cohérent
   avec la nav, et identique sur tous les appareils) ═══ */
const ICONES = {
  verre: '<path d="M7 3h10c0 5.2-2 8.5-5 8.5S7 8.2 7 3Z"/><path d="M12 11.5V19M8.5 21h7"/>',
  flacon: '<path d="M10 3h4v3.5L15.5 9v10a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V9L10 6.5V3Z"/><path d="M8.5 14h7"/>',
  photo: '<path d="M4 8h2.5L8 6h8l1.5 2H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  etincelles: '<path d="M12 4l1.3 3.7L17 9l-3.7 1.3L12 14l-1.3-3.7L7 9l3.7-1.3L12 4Z"/><path d="M18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.5 6M20 5v6h-6"/>',
  de: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.15" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.15" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.15" fill="currentColor" stroke="none"/>',
  fiche: '<path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v4h4"/>',
};
const ico = (nom, t = 15) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${ICONES[nom]}</svg>`;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ecranActif = 'cave';
let ecranAvantProfil = 'cave'; // pour le bouton « ‹ Retour » du profil
let filtreCouleur = null;
let occasion = 'weekend';
let aAjouter = []; // bouteilles en attente de confirmation
let catCave = 'vin';
let catAjout = 'vin';
let filtreTypeSpirit = null;
let filtreOuvert = null; // null | 'ouverte' | 'fermee'
let filtreMaturite = null; // null | 'aboire' (vins prêts : apogée, à boire vite, sur le déclin)

// États de maturité considérés « à boire maintenant », par ordre de priorité
const A_BOIRE = ['urgent', 'passe', 'apogee'];
const PRIO_DEGUSTATION = { urgent: 0, passe: 1, apogee: 2 };

// Une bouteille de spiritueux est « ouverte » dès que son niveau est entamé
const estOuverte = (b) => b.niveau != null && b.niveau < 100;

// Le sommelier et la roulette ne piochent que dans les vins
const vinsSeuls = (bottles) => bottles.filter((b) => b.categorie !== 'spiritueux');

/* ═══ Voix du caveau : un peu de fantaisie ═══ */
const alea = (arr) => arr[Math.floor(Math.random() * arr.length)];
const PHRASES_AJOUT = [
  'Bouteille ajoutée à votre cave.',
  'Une pensionnaire de plus dans la cave !',
  'Très belle pioche. Je la couche précieusement.',
  'C\'est noté ! Votre cave prend de la valeur.',
  'Entrée en cave. Elle y sera très bien.',
  'Adoptée ! Je veille sur elle désormais.',
  'Encore une merveille à l\'abri de la lumière.',
  'Elle rejoint ses sœurs dans la pénombre. Parfait.',
];
const PHRASES_AJOUT_LOT = [
  (n) => `${n} bouteilles ajoutées à votre cave.`,
  (n) => `Belle rentrée : ${n} flacons de plus dans la cave !`,
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
const ORDRE_ONGLETS = ['cave', 'ajouter', 'sommelier', 'alertes', 'stats'];

// Direction de la chorégraphie selon d'où l'on vient et où l'on va.
function sensEcran(de, vers) {
  if (vers === 'profil') return 'profil';
  if (de === 'profil') return 'profil-retour';
  return ORDRE_ONGLETS.indexOf(vers) >= ORDRE_ONGLETS.indexOf(de) ? 'avant' : 'arriere';
}

export function montrerEcran(nom) {
  const sens = sensEcran(ecranActif, nom);
  const changement = nom !== ecranActif;
  const appliquer = () => {
    // Mémorise d'où l'on vient avant d'entrer dans le profil (pour le retour).
    if (nom === 'profil' && ecranActif !== 'profil') ecranAvantProfil = ecranActif;
    ecranActif = nom;
    document.querySelectorAll('.ecran').forEach((e) => { e.hidden = e.id !== `ecran-${nom}`; });
    // Le profil n'est pas dans la barre du bas : aucun onglet actif dans ce cas.
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('actif', b.dataset.ecran === nom));
    rendre(nom);
    window.scrollTo({ top: 0 });
  };
  if (changement) transitionEcran(sens, appliquer);
  else appliquer();
}

function rendre(nom) {
  if (nom === 'cave') rendreCave();
  if (nom === 'alertes') rendreAlertes();
  if (nom === 'stats') rendreStats();
  if (nom === 'sommelier') rendreSommelier();
  if (nom === 'profil') rendreProfil();
  majBadgeAlertes();
  bulleOnboarding(nom);
}

/* ═══ Onboarding : une bulle par écran, à la première visite seulement.
   Les titres descriptifs ont disparu — c'est elle qui présente les lieux. ═══ */
const ONBOARDING = {
  cave: () => t('onboard.cave'),
  ajouter: () => t('onboard.ajouter'),
  sommelier: () => t('onboard.sommelier'),
  alertes: () => t('onboard.alertes'),
  stats: () => t('onboard.stats'),
};
function bulleOnboarding(nom) {
  const cle = `caveau:onboard:${nom}`;
  if (!ONBOARDING[nom] || localStorage.getItem(cle)) return;
  localStorage.setItem(cle, '1');
  const bulle = document.createElement('div');
  bulle.className = 'bulle-onboard';
  bulle.innerHTML = `<p>${ONBOARDING[nom]()}</p><button>${t('onboard.compris')}</button>`;
  // sur le Sommelier, la bulle flotte sur la scène fluide
  const hote = nom === 'sommelier' ? $('#orbe-scene') : $(`#ecran-${nom}`);
  hote.prepend(bulle);
  bulle.querySelector('button').onclick = () => {
    vibrer('tic');
    bulle.classList.add('sortie');
    setTimeout(() => bulle.remove(), 320);
  };
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
    `<option value="__autre">${t('select.autreRegion')}</option>`;
}
function optionsPays(selection) {
  const connus = [...new Set([...PAYS, ...store.get().bottles.map((b) => b.pays), selection])]
    .filter(Boolean).sort((a, z) => a.localeCompare(z, 'fr'));
  const cle = (p) => p === 'Afrique du Sud' ? 'AfriqueSud' : p.normalize("NFD").replace(/[\u0300-\u036f\- ]/g, "");
  return connus.map((p) => `<option value="${esc(p)}" ${p === selection ? 'selected' : ''}>${esc(t('pays.' + cle(p)) || p)}</option>`).join('') +
    `<option value="__autre">${t('select.autrePays')}</option>`;
}
// Branche les couples pays ↔ région d'un conteneur : « Autre… » crée une
// valeur libre, et changer le pays refiltre la liste des régions.
function brancherSelectsRegion(racine) {
  racine.querySelectorAll('select[data-region]').forEach((sel) => {
    sel.onchange = () => {
      if (sel.value !== '__autre') return;
      const nom = (prompt(t('prompt.nouvelleRegion')) || '').trim();
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
        const nom = (prompt(t('prompt.nouveauPays')) || '').trim();
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
function optionsListe(liste, selection, prefix = null) {
  const tout = [...new Set([...liste, selection])].filter(Boolean);
  return tout.map((x) => `<option value="${esc(x)}" ${x === selection ? 'selected' : ''}>${esc(prefix ? (t(`${prefix}.${x.toLowerCase().replace(/[\s/]/g, '')}`) || x) : x)}</option>`).join('');
}

// Entrée en cascade : chaque carte arrive avec un léger décalage, comme un
// jeu de cartes qu'on étale. Plafonné pour que les longues listes restent vives.
function cascade(parent) {
  parent.querySelectorAll('.carte, .groupe-region').forEach((el, i) => {
    el.style.animationDelay = `${Math.min(i * 26, 320)}ms`;
  });
}

// Compteur animé : le nombre monte vers sa cible en ~700 ms (freiné en fin
// de course). Le suffixe (€…) reste accroché au nombre.
function compterVers(el, cible, suffixe = '') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || cible <= 0) {
    el.textContent = `${cible}${suffixe}`;
    return;
  }
  const t0 = performance.now();
  const duree = 700;
  const pas = (t) => {
    const p = Math.min(1, (t - t0) / duree);
    const freine = 1 - Math.pow(1 - p, 3); // ease-out cubique
    el.textContent = `${Math.round(cible * freine)}${suffixe}`;
    if (p < 1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
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
    <div><div class="v">${nb}</div><div class="l">${t('cave.bouteilles')}</div></div>
    <div id="cellule-valeur" title="Toucher pour masquer/afficher"><div class="v">${valeurTxt}</div><div class="l">${t('cave.valeur')} ${settings.valeurCachee ? '👁' : ''}</div></div>
    ${catCave === 'vin' ? `<div><div class="v">${aBoire}</div><div class="l">${t('cave.aboire')}</div></div>` : `<div><div class="v">${enCave.length}</div><div class="l">${t('cave.references')}</div></div>`}`;
  $('#cellule-valeur').onclick = () => {
    store.majSettings({ valeurCachee: !store.get().settings.valeurCachee });
    rendreCave();
  };

  // Filtres : couleur pour les vins · type + ouverte/fermée pour les spiritueux
  if (catCave === 'vin') {
    $('#filtres-couleur').innerHTML =
      `<button class="puce puce-aboire ${filtreMaturite === 'aboire' ? 'actif' : ''}" data-mat="aboire" style="margin-right:10px">${ico('verre', 12)} ${t('cave.filtreAboire')}</button>` +
      ['toutes', ...COULEURS].map((c) =>
        `<button class="puce ${((c === 'toutes' && !filtreCouleur) || c === filtreCouleur) ? 'actif' : ''}" data-c="${c}">${c === 'toutes' ? t('cave.toutes') : t(`couleur.${c}`)}</button>`
      ).join('');
    $('#filtres-couleur').querySelectorAll('[data-c]').forEach((p) => p.onclick = () => {
      filtreCouleur = p.dataset.c === 'toutes' ? null : p.dataset.c;
      rendreCave();
    });
    $('#filtres-couleur').querySelectorAll('[data-mat]').forEach((p) => p.onclick = () => {
      filtreMaturite = filtreMaturite === p.dataset.mat ? null : p.dataset.mat;
      rendreCave();
    });
  } else {
    const typesPresents = [...new Set(enCave.map((b) => b.type || t('format.autre')))].sort((a, z) => a.localeCompare(z, 'fr'));
    $('#filtres-couleur').innerHTML =
      `<button class="puce ${!filtreTypeSpirit ? 'actif' : ''}" data-t="__tous">${t('cave.tous')}</button>` +
      typesPresents.map((t) => `<button class="puce ${filtreTypeSpirit === t ? 'actif' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('') +
      `<button class="puce ${filtreOuvert === 'ouverte' ? 'actif' : ''}" data-o="ouverte" style="margin-left:10px">${t('cave.ouverte')}</button>` +
      `<button class="puce ${filtreOuvert === 'fermee' ? 'actif' : ''}" data-o="fermee">${t('cave.fermees')}</button>`;
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
  if (catCave === 'vin' && filtreMaturite === 'aboire') visibles = visibles.filter((b) => A_BOIRE.includes(maturite(b).code));
  if (catCave === 'spiritueux') {
    if (filtreTypeSpirit) visibles = visibles.filter((b) => (b.type || t('format.autre')) === filtreTypeSpirit);
    if (filtreOuvert === 'ouverte') visibles = visibles.filter(estOuverte);
    if (filtreOuvert === 'fermee') visibles = visibles.filter((b) => !estOuverte(b));
  }
  if (recherche) visibles = visibles.filter((b) =>
    `${b.nom} ${b.domaine || ''} ${b.appellation || ''} ${b.region || ''} ${b.type || ''} ${b.millesime || ''}`.toLowerCase().includes(recherche));

  if (!visibles.length) {
    const vide = filtreMaturite === 'aboire' ? t('cave.videAboire')
      : catCave === 'vin' ? t('cave.vide') : t('cave.videSpiriteux');
    const sous = filtreMaturite === 'aboire' ? t('cave.rienPresse')
      : enCave.length ? '' : t('cave.ajouterInvite');
    $('#liste-cave').innerHTML = `<div class="vide"><div class="gros">${enCave.length ? t('cave.videFiltre') : vide}</div>${enCave.length && filtreMaturite !== 'aboire' ? '' : sous}</div>`;
    return;
  }

  // Filtre « À boire » : liste à plat triée par priorité de dégustation
  if (catCave === 'vin' && filtreMaturite === 'aboire') {
    const liste = visibles.slice().sort((a, z) =>
      (PRIO_DEGUSTATION[maturite(a).code] - PRIO_DEGUSTATION[maturite(z).code])
      || (a.gardeA || 9999) - (z.gardeA || 9999));
    const nbB = liste.reduce((s, b) => s + b.qty, 0);
    $('#liste-cave').innerHTML = `<div class="groupe-region">${ico('verre', 16)} ${t('cave.aBoireMaintenant')} <small>${nbB} ${t('cave.btl')}</small></div>` +
      liste.map(carteHTML).join('');
    cascade($('#liste-cave'));
    $('#liste-cave').querySelectorAll('.carte').forEach((c) => c.onclick = () => ouvrirFiche(c.dataset.id));
    return;
  }

  // Vins groupés par région · spiritueux groupés par type
  const cle = catCave === 'vin' ? 'region' : 'type';
  const groupes = {};
  visibles.forEach((b) => (groupes[b[cle] || t('format.autre')] ??= []).push(b));
  const groupesTries = Object.keys(groupes).sort((a, z) =>
    groupes[z].reduce((s, b) => s + b.qty, 0) - groupes[a].reduce((s, b) => s + b.qty, 0));

  $('#liste-cave').innerHTML = groupesTries.map((g) => {
    const liste = catCave === 'vin'
      ? groupes[g].sort((a, z) => maturite(a).ordre - maturite(z).ordre)
      : groupes[g].sort((a, z) => (a.nom || '').localeCompare(z.nom || ''));
    const nbG = liste.reduce((s, b) => s + b.qty, 0);
    return `<div class="groupe-region">${esc(g)} <small>${nbG} ${t('cave.btl')}</small></div>` +
      liste.map(carteHTML).join('');
  }).join('');

  cascade($('#liste-cave'));
  $('#liste-cave').querySelectorAll('.carte').forEach((c) => c.onclick = () => ouvrirFiche(c.dataset.id));
}

function carteHTML(b) {
  if (b.categorie === 'spiritueux') {
    return `<div class="carte" data-id="${b.id}">
      <div class="carte-couleur c-spirit"></div>
      ${imageAffichee(b) ? `<img class="carte-thumb" src="${imageAffichee(b)}" alt="">` : ''}
      <div class="carte-corps">
        <div class="carte-nom">${esc([b.domaine, b.nom].filter(Boolean).join(' '))}</div>
        <div class="carte-meta">${esc(b.type || t('tab.spiritueux'))}${b.age ? ` · ${b.age} ${t('spirit.age').split(' ')[0].toLowerCase()}` : ''}${b.alcool ? ` · ${b.alcool}%` : ''}${b.prix ? ` · ${b.prix} €` : ''}${b.noteWeb ? ` · <span class="note-viv">★ ${esc(b.noteWeb)}</span>` : ''}${b.maNote ? ` · <span class="note-moi">${b.maNote}/100</span>` : ''}</div>
        ${estOuverte(b) ? `<span class="cachet ${b.niveau <= 25 ? 'cachet-urgent' : 'cachet-approche'}">${b.niveau <= 25 ? t('cave.aFinir') : t('cave.ouverte')} · ${b.niveau} %</span>` : ''}
      </div>
      <div class="carte-fin"><div class="carte-qty">×<b>${b.qty}</b></div></div>
    </div>`;
  }
  const m = maturite(b);
  return `<div class="carte" data-id="${b.id}">
    <div class="carte-couleur c-${b.couleur}"></div>
    ${imageAffichee(b) ? `<img class="carte-thumb" src="${imageAffichee(b)}" alt="">` : ''}
    <div class="carte-corps">
      <div class="carte-nom">${esc(b.nom)} ${b.millesime ? `<span class="mil">${b.millesime}</span>` : ''}</div>
      <div class="carte-meta">${esc(b.appellation || b.region)}${b.prix ? ` · ${b.prix} €` : ''}${b.noteVivino ? ` · <span class="note-viv">★ ${String(b.noteVivino).replace('.', ',')}</span>` : ''}${b.maNote ? ` · <span class="note-moi">${b.maNote}/100</span>` : ''}</div>
      <span class="cachet cachet-${m.code}">${t(`mat.${m.code}`)}</span>
    </div>
    <div class="carte-fin"><div class="carte-qty">×<b>${b.qty}</b></div></div>
  </div>`;
}

/* ═══ Fiche bouteille (bottom sheet) ═══ */
/* ═══ Image de la bouteille (générée par l'IA, mise en cache) ═══ */

// Réduit une data URL en vignette JPEG légère pour tenir dans localStorage.
async function compresserDataUrl(dataUrl, maxH = 540, q = 0.82) {
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = dataUrl; });
  const ratio = Math.min(1, maxH / img.height);
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * ratio); cv.height = Math.round(img.height * ratio);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', q);
}

// Image à afficher : la version stylisée si elle existe, sinon la photo prise.
const imageAffichee = (b) => b.image || b.photoOrig || null;

// Bloc image en tête de fiche. Aucune génération automatique. On peut
// toujours attacher sa propre photo (sans IA), et l'embellir/générer si clé.
function blocImage(b) {
  const { apiKey } = store.get().settings;
  const aff = imageAffichee(b);
  const input = `<input type="file" accept="image/*" data-photo="${b.id}" hidden>`;
  if (aff) {
    const regen = apiKey ? `<button class="photo-regen" data-regen="${b.id}">${b.photoOrig ? `${ico('etincelles', 12)} ${t('fiche.embellir')}` : `${ico('refresh', 12)} ${t('fiche.regenerer')}`}</button>` : '';
    const revert = (b.image && b.photoOrig) ? `<button class="photo-regen" data-revert="${b.id}">↩︎ ${t('fiche.mettrePhoto')}</button>` : '';
    const photo = `<button class="photo-regen" data-photobtn="${b.id}">${ico('photo', 12)} ${b.photoOrig ? t('fiche.changerPhoto') : t('fiche.mettrePhoto')}</button>`;
    return `<div class="photo-bouteille"><img src="${aff}" alt="${esc(b.nom || '')}"><div class="photo-actions">${regen}${revert}${photo}</div>${input}</div>`;
  }
  // Pas encore d'image : ajouter sa photo (toujours) + générer (si clé)
  const gen = apiKey ? `<button class="photo-regen" data-regen="${b.id}">${ico('etincelles', 12)} ${t('fiche.genererIllustration')}</button>` : '';
  return `<div class="photo-bouteille"><div class="photo-actions"><button class="photo-regen" data-photobtn="${b.id}">${ico('photo', 12)} ${t('fiche.ajouterPhoto')}</button>${gen}</div>${input}</div>`;
}

// Rebranche les boutons du bloc image (photo / régénérer / revenir à ma photo).
function monterImage(id) {
  const regen = $(`[data-regen="${id}"]`);
  if (regen) regen.onclick = () => genererEtAfficher(id);
  const revert = $(`[data-revert="${id}"]`);
  if (revert) revert.onclick = () => {
    store.majBouteille(id, { image: null }); // retombe sur photoOrig
    majBlocImage(id);
    if (ecranActif === 'cave') rendreCave();
  };
  const input = $(`[data-photo="${id}"]`);
  const photoBtn = $(`[data-photobtn="${id}"]`);
  if (photoBtn && input) photoBtn.onclick = () => input.click();
  if (input) input.onchange = (e) => {
    const f = e.target.files[0];
    if (f) attacherPhoto(id, f);
    e.target.value = '';
  };
}

// Attache la photo prise par l'utilisateur comme image de la bouteille.
async function attacherPhoto(id, file) {
  const slot = $('.photo-bouteille');
  if (slot) slot.innerHTML = `<div class="photo-charge"><span class="photo-shimmer"></span>${t('fiche.chargementPhoto')}</div>`;
  try {
    const { dataUrl } = await compresser(file);
    const vignette = await compresserDataUrl(dataUrl, 680, 0.8);
    store.majBouteille(id, { photoOrig: vignette, image: null }); // la photo devient l'image affichée
    if (!$('#feuille').hidden) majBlocImage(id);
    if (ecranActif === 'cave') rendreCave();
    toast('Photo enregistrée');
  } catch (e) {
    if (!$('#feuille').hidden) majBlocImage(id);
    toast(`Photo impossible : ${e.message}`);
  }
}

function majBlocImage(id) {
  const b = store.get().bottles.find((x) => x.id === id);
  const slot = $('.photo-bouteille');
  if (slot && b) { slot.outerHTML = blocImage(b); monterImage(id); }
}

// Génère/restyle l'image. Si une photo existe (photoOrig), on la RETRAVAILLE
// (même bouteille, plus beau décor) ; sinon on dessine d'après les caractéristiques.
async function genererEtAfficher(id) {
  const { apiKey } = store.get().settings;
  const b = store.get().bottles.find((x) => x.id === id);
  if (!b || !apiKey) return;
  const source = b.photoOrig || null;
  const slot = $('.photo-bouteille');
  if (slot) slot.innerHTML = `<div class="photo-charge"><span class="photo-shimmer"></span>${source ? 'Mise en valeur de votre photo…' : 'Le sommelier dessine votre bouteille…'}</div>`;
  try {
    const brute = await genererImageBouteille(apiKey, b, source);
    if (!brute) throw new Error('Pas d\'image renvoyée');
    const vignette = await compresserDataUrl(brute);
    store.majBouteille(id, { image: vignette });
    if (!$('#feuille').hidden) majBlocImage(id);
    if (ecranActif === 'cave') rendreCave();
  } catch (e) {
    if (!$('#feuille').hidden) majBlocImage(id);
    toast(`Image impossible : ${e.message}`);
    console.warn('Image bouteille impossible', e);
  }
}

function ouvrirFiche(id) {
  $('#feuille').dataset.courant = id;
  const b = store.get().bottles.find((x) => x.id === id);
  if (!b) return;
  if (b.categorie === 'spiritueux') { ouvrirFicheSpirit(b); return; }
  const m = maturite(b);
  $('#feuille-contenu').innerHTML = `
    <h3>${esc(b.nom)} ${b.millesime ? `<em style="color:var(--or-clair)">${b.millesime}</em>` : ''}</h3>
    <p style="color:var(--creme-45);font-size:13px;margin-top:4px">${esc(b.domaine || '')}
      <span class="cachet cachet-${m.code}">${m.label}</span>
      ${b.noteVivino ? `<span class="note-viv" style="margin-left:6px">★ ${String(b.noteVivino).replace('.', ',')}/5 Vivino</span>` : ''}
      ${b.gardeDe ? `<span style="margin-left:6px">${t('fiche.gardeDe').toLowerCase()} ${b.gardeDe}–${b.gardeA}</span>` : ''}</p>
    ${blocImage(b)}
    <div class="ligne">
      <div style="flex:3"><label>${t('fiche.nom')}</label><input id="f-nom" value="${esc(b.nom)}"></div>
    </div>
    <div class="ligne">
      <div style="flex:2"><label>${t('fiche.domaine')}</label><input id="f-domaine" value="${esc(b.domaine || '')}"></div>
    </div>
    <div class="ligne">
      <div style="flex:2"><label>${t('fiche.appellation')}</label><input id="f-appellation" value="${esc(b.appellation || '')}"></div>
      <div style="flex:1"><label>${t('fiche.millesime')}</label><input id="f-mil" type="number" value="${b.millesime || ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>${t('fiche.pays')}</label><select id="f-pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
      <div style="flex:1"><label>${t('fiche.region')}</label><select id="f-region" data-region>${optionsRegion(b.region, b.pays || 'France')}</select></div>
      <div style="flex:1"><label>${t('fiche.couleur')}</label><select id="f-couleur">${optionsListe(COULEURS, b.couleur, 'couleur')}</select></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>${t('fiche.prix')}</label><input id="f-prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
      <div style="flex:1"><label>${t('fiche.quantite')}</label><input id="f-qty" type="number" min="0" value="${b.qty}"></div>
      <div style="flex:1"><label>${t('fiche.gardeDe')}</label><input id="f-gde" type="number" value="${b.gardeDe || ''}"></div>
      <div style="flex:1"><label>${t('fiche.gardeA')}</label><input id="f-gda" type="number" value="${b.gardeA || ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1.4"><label>${t('fiche.cepages')}</label><input id="f-cepages" value="${esc(Array.isArray(b.cepages) ? b.cepages.join(', ') : (b.cepages || ''))}"></div>
      <div style="flex:1"><label>${t('fiche.format')}</label><select id="f-format">${optionsListe(FORMATS, b.format || '75 cl')}</select></div>
      <div style="flex:.7"><label>${t('fiche.alcool')}</label><input id="f-alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
    </div>
    ${b.description ? `<div class="bulle-ia" style="margin-top:10px;font-size:13px">📜 ${esc(b.description)}</div>` : ''}
    <h4 class="sous-titre" style="margin:14px 0 6px;font-size:17px">${t('fiche.monAvis')}</h4>
    <div class="note100-wrap">
      <label>${t('fiche.maNote')} <b id="f-manote-val">${b.maNote ? `${b.maNote}/100` : '—'}</b></label>
      <input id="f-manote" type="range" min="0" max="100" step="1" value="${b.maNote ?? 0}">
    </div>
    <div class="notes-dictee">
      <div><label>${t('fiche.notesDegustation')}</label><textarea id="f-notes" rows="2" placeholder="${t('fiche.placeholderNotes')}">${esc(b.notes || '')}</textarea></div>
      <button class="micro micro-mini" id="f-micro-notes" aria-label="Dicter mes notes">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
      </button>
    </div>
    <div class="actions">
      <button class="btn-or" id="f-sortir" style="flex:1.4">${ico('verre', 14)} ${t('fiche.jeLaSors')}</button>
      <button class="btn-sombre" id="f-save" style="flex:1">${t('fiche.enregistrer')}</button>
    </div>
    <div class="liens-rachat" style="margin-top:14px">${liensRachatHTML(b)}</div>
    <div id="f-equiv"></div>
    ${store.get().settings.apiKey ? `<button class="btn-fantome" id="f-btn-equiv">${ico('etincelles', 14)} ${t('fiche.equivalents')}</button>` : ''}
    <button class="btn-discret btn-danger" id="f-suppr" style="width:100%;margin-top:8px">${t('fiche.supprimer')}</button>`;
  montrerFeuille(true);
  monterImage(id);

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
    montrerFeuille(false); rendre(ecranActif); toast(t('fiche.toastMAJ'));
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
  $('#f-manote').oninput = () => {
    const v = parseInt($('#f-manote').value);
    $('#f-manote-val').textContent = v ? `${v}/100` : '—';
  };
  $('#f-sortir').onclick = () => { dialogueSortie(id); }; // remplace le contenu, modale déjà ouverte
  $('#f-suppr').onclick = () => {
    if (confirm(t('fiche.confirmerSuppression').replace('{nom}', b.nom))) {
      store.supprimerBouteille(id); montrerFeuille(false); rendre(ecranActif); toast(t('fiche.toastSupprimee'));
    }
  };
  const btnEq = $('#f-btn-equiv');
  if (btnEq) btnEq.onclick = async () => {
    btnEq.innerHTML = `${ico('etincelles', 14)} ${t('fiche.equivalentsChargement')}`; btnEq.disabled = true;
    try {
      const rep = await equivalents(store.get().settings.apiKey, b);
      $('#f-equiv').innerHTML = `<div class="bulle-ia">${esc(rep)}</div>`;
    } catch (e) { toast(e.message); }
    btnEq.innerHTML = `${ico('etincelles', 14)} ${t('fiche.equivalents')}`; btnEq.disabled = false;
  };
}

function ouvrirFicheSpirit(b) {
  const id = b.id;
  $('#feuille').dataset.courant = id;
  $('#feuille-contenu').innerHTML = `
    <h3>${esc([b.domaine, b.nom].filter(Boolean).join(' '))}</h3>
    <p style="color:var(--creme-45);font-size:13px;margin-top:4px">${esc(b.type || t('tab.spiritueux'))}
      ${b.noteWeb ? `<span class="note-viv" style="margin-left:6px">★ ${esc(b.noteWeb)}</span>` : ''}</p>
    ${blocImage(b)}
    <div class="ligne">
      <div style="flex:1"><label>${t('spirit.type')}</label><select id="f-type">${optionsListe(TYPES_SPIRITUEUX, b.type || t('format.autre'))}</select></div>
      <div style="flex:1.3"><label>${t('spirit.marque')}</label><input id="f-domaine" value="${esc(b.domaine || '')}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1.6"><label>${t('spirit.nom')}</label><input id="f-nom" value="${esc(b.nom || '')}"></div>
      <div style="flex:.7"><label>${t('spirit.age')}</label><input id="f-age" type="number" min="0" value="${b.age ?? ''}"></div>
      <div style="flex:.7"><label>${t('fiche.alcool')}</label><input id="f-alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
    </div>
    <div class="ligne">
      <div style="flex:1"><label>${t('fiche.pays')}</label><select id="f-pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
      <div style="flex:.8"><label>${t('fiche.format')}</label><select id="f-format">${optionsListe(FORMATS, b.format || '75 cl')}</select></div>
      <div style="flex:.7"><label>${t('fiche.prix')}</label><input id="f-prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
      <div style="flex:.7"><label>${t('fiche.quantite')}</label><input id="f-qty" type="number" min="0" value="${b.qty}"></div>
    </div>
    <div class="bloc-niveau">
      <label>${t('spirit.niveau')} <b id="f-niveau-val">${b.niveau ?? 100} %</b><span id="f-niveau-alerte" style="color:var(--rouge-vif)">${(b.niveau ?? 100) <= 25 ? ` ${t('spirit.aFinir')}` : ''}</span></label>
      <input id="f-niveau" type="range" min="0" max="100" step="5" value="${b.niveau ?? 100}">
    </div>
    ${b.description ? `<div class="bulle-ia" style="margin-top:10px;font-size:13px">📜 ${esc(b.description)}</div>` : ''}
    <h4 class="sous-titre" style="margin:14px 0 6px;font-size:17px">${t('spirit.monAvis')}</h4>
    <div class="note100-wrap">
      <label>${t('fiche.maNote')} <b id="f-manote-val">${b.maNote ? `${b.maNote}/100` : '—'}</b></label>
      <input id="f-manote" type="range" min="0" max="100" step="1" value="${b.maNote ?? 0}">
    </div>
    <div class="notes-dictee">
      <div><label>${t('fiche.notesDegustation')}</label><textarea id="f-notes" rows="2" placeholder="${t('fiche.placeholderNotes')}">${esc(b.notes || '')}</textarea></div>
      <button class="micro micro-mini" id="f-micro-notes" aria-label="Dicter mes notes">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
      </button>
    </div>
    <div class="actions">
      <button class="btn-or" id="f-sortir" style="flex:1.4">${ico('flacon', 14)} ${t('spirit.jeLeSors')}</button>
      <button class="btn-sombre" id="f-save" style="flex:1">${t('fiche.enregistrer')}</button>
    </div>
    <div class="liens-rachat" style="margin-top:14px">${liensRachatHTML(b)}</div>
    <button class="btn-discret btn-danger" id="f-suppr" style="width:100%;margin-top:8px">${t('fiche.supprimer')}</button>`;
  montrerFeuille(true);
  monterImage(id);
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
    montrerFeuille(false); rendre(ecranActif); toast(t('fiche.toastMAJ'));
  };
  $('#f-niveau').oninput = () => {
    const v = parseInt($('#f-niveau').value);
    $('#f-niveau-val').textContent = `${v} %`;
    $('#f-niveau-alerte').textContent = v <= 25 && v > 0 ? ` ${t('spirit.aFinir')}` : '';
  };
  // Le niveau s'enregistre tout seul dès qu'on lâche le curseur
  $('#f-niveau').onchange = () => {
    store.majBouteille(id, { niveau: parseInt($('#f-niveau').value) });
    rendreCave(); majBadgeAlertes();
  };
  $('#f-sortir').onclick = () => {
    store.sortirBouteille(id, '', '');
    vibrer('sortie');
    montrerFeuille(false); rendre(ecranActif);
    const restant = store.get().bottles.find((x) => x.id === id)?.qty ?? 0;
    toast(restant > 0 ? t('spirit.toastSortie').replace('{restant}', restant) : t('spirit.toastDerniere'));
  };
  $('#f-suppr').onclick = () => {
    if (confirm(t('fiche.confirmerSuppression').replace('{nom}', b.nom))) {
      store.supprimerBouteille(id); montrerFeuille(false); rendre(ecranActif); toast(t('fiche.toastSupprimee'));
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
  $('#f-manote').oninput = () => {
    const v = parseInt($('#f-manote').value);
    $('#f-manote-val').textContent = v ? `${v}/100` : '—';
  };
}

function dialogueSortie(id) {
  const b = store.get().bottles.find((x) => x.id === id);
  $('#feuille-contenu').innerHTML = `
    <h3>${t('sortie.titre').replace('{nom}', esc(b.nom) + (b.millesime ? ' ' + b.millesime : ''))}</h3>
    <div class="ligne"><div style="flex:1"><label>${t('sortie.occasion')}</label><input id="s-occ" placeholder="${t('sortie.placeholderOccasion')}"></div></div>
    <div class="ligne"><div style="flex:1"><label>${t('sortie.impression')}</label><input id="s-note" placeholder="${t('sortie.placeholderImpression')}"></div></div>
    <div class="actions">
      <button class="btn-or" id="s-ok" style="flex:1">${t('sortie.sante')}</button>
      <button class="btn-sombre" id="s-annule" style="flex:.6">${t('sortie.annuler')}</button>
    </div>`;
  montrerFeuille(true);
  $('#s-ok').onclick = () => {
    store.sortirBouteille(id, $('#s-occ').value.trim(), $('#s-note').value.trim());
    vibrer('sortie');
    montrerFeuille(false); rendre(ecranActif);
    const restant = store.get().bottles.find((x) => x.id === id)?.qty ?? 0;
    toast(restant > 0 ? t('sortie.toastBonne').replace('{restant}', restant) : t('sortie.toastDerniere'));
    dire(restant > 0 ? alea(PHRASES_SORTIE) : t('sortie.toastDerniere'));
    majBadgeAlertes();
  };
  $('#s-annule').onclick = () => montrerFeuille(false);
}

let feuilleOuverte = false;

function montrerFeuille(visible) {
  $('#feuille').hidden = !visible;
  $('#voile').hidden = !visible;
  $('#feuille').style.transform = ''; // annule un éventuel glissé en cours
  if (visible) vibrer('tic');
  if (visible && !feuilleOuverte) {
    feuilleOuverte = true;
    // Empile un état d'historique : le bouton/geste « retour » d'Android
    // refermera la modale au lieu de quitter la page.
    history.pushState({ caveauSheet: true }, '');
  } else if (!visible && feuilleOuverte) {
    feuilleOuverte = false;
    if (history.state && history.state.caveauSheet) history.back();
  }
}

// Geste/bouton retour : referme la modale si elle est ouverte.
window.addEventListener('popstate', () => {
  if (feuilleOuverte) {
    feuilleOuverte = false;
    $('#feuille').hidden = true;
    $('#voile').hidden = true;
    $('#feuille').style.transform = '';
  }
});

// Glisser la poignée vers le bas pour refermer la modale, avec une vraie
// physique : la feuille suit le doigt, un mouvement vif suffit à la lancer
// (vélocité), sinon elle revient se caler avec un léger rebond de ressort.
function brancherGlissementFeuille() {
  const feuille = $('#feuille');
  const voile = $('#voile');
  const poignee = $('#feuille-poignee');
  let y0 = null, dy = 0, yPrec = 0, tPrec = 0, vitesse = 0;

  poignee.addEventListener('touchstart', (e) => {
    y0 = yPrec = e.touches[0].clientY;
    tPrec = performance.now();
    dy = 0; vitesse = 0;
    feuille.style.transition = 'none';
    voile.style.transition = 'none';
  }, { passive: true });

  poignee.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    const y = e.touches[0].clientY;
    const t = performance.now();
    vitesse = (y - yPrec) / Math.max(1, t - tPrec); // px/ms, signé
    yPrec = y; tPrec = t;
    dy = y - y0;
    // Vers le haut : résistance élastique (la feuille « tire » sur sa butée).
    const affiche = dy >= 0 ? dy : -Math.pow(-dy, 0.65);
    feuille.style.transform = `translateY(${affiche}px)`;
    // Le voile s'éclaircit à mesure qu'on tire — donne la sensation de profondeur.
    voile.style.opacity = String(Math.max(0.25, 1 - Math.max(0, dy) / 480));
  }, { passive: true });

  poignee.addEventListener('touchend', () => {
    if (y0 == null) return;
    voile.style.transition = '';
    voile.style.opacity = '';
    const lancee = dy > 130 || vitesse > 0.55; // distance OU pichenette rapide
    if (lancee) {
      vibrer('tic');
      feuille.style.transition = 'transform .22s cubic-bezier(.4, .7, .6, 1)';
      feuille.style.transform = 'translateY(105%)';
      setTimeout(() => { feuille.style.transition = ''; montrerFeuille(false); }, 210);
    } else {
      // ressort : dépasse légèrement sa position puis se cale
      feuille.style.transition = 'transform .45s cubic-bezier(.18, 1.35, .35, 1)';
      feuille.style.transform = '';
      setTimeout(() => { feuille.style.transition = ''; }, 460);
    }
    y0 = null;
  });
}

function brancherGlissementFicheHori() {
  const contenu = $('#feuille-contenu');
  let x0 = null, y0 = null, dx = 0, dy = 0, swipeEnCours = false, swipeHori = false;

  contenu.addEventListener('touchstart', (e) => {
    // Ne pas interférer avec les sliders
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    dx = dy = 0;
    swipeEnCours = true;
    swipeHori = false;
    contenu.style.transition = 'none';
  }, { passive: true });

  contenu.addEventListener('touchmove', (e) => {
    if (!swipeEnCours || x0 == null) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    dx = x - x0;
    dy = y - y0;
    
    if (!swipeHori && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swipeHori = true;
    }
    
    if (swipeHori) {
      const affiche = dx > 0 ? Math.pow(dx, 0.85) : -Math.pow(-dx, 0.85);
      contenu.style.transform = `translateX(${affiche}px)`;
    }
  }, { passive: true });

  contenu.addEventListener('touchend', () => {
    if (!swipeEnCours || x0 == null) return;
    swipeEnCours = false;
    if (swipeHori) {
      const lancee = Math.abs(dx) > 80;
      if (lancee) {
        const direction = dx > 0 ? -1 : 1; // dx>0: droite (précédent), dx<0: gauche (suivant)
        const idCourant = $('#feuille').dataset.courant;
        const voisinId = getVoisinId(idCourant, direction);
        
        if (voisinId) {
          vibrer('tic');
          glisserFicheVers(voisinId, direction);
        } else {
          annulerGlissement();
        }
      } else {
        annulerGlissement();
      }
    }
    x0 = y0 = null;
  });
  
  function annulerGlissement() {
    contenu.style.transition = 'transform .3s cubic-bezier(.18, 1.35, .35, 1)';
    contenu.style.transform = '';
  }
}

function getVoisinId(courantId, dir) {
  const elements = Array.from(document.querySelectorAll('.carte, .reco, .item-hist'))
    .filter(el => {
      const p = el.closest('[hidden]');
      return !p && el.style.display !== 'none';
    });
  const index = elements.findIndex(e => e.dataset.id === courantId);
  if (index === -1) return null;
  const voisin = elements[index + dir];
  return voisin ? voisin.dataset.id : null;
}

function glisserFicheVers(id, direction) {
  const contenu = $('#feuille-contenu');
  contenu.style.transition = 'transform 0.2s, opacity 0.2s';
  contenu.style.transform = `translateX(${direction * -100}px)`;
  contenu.style.opacity = '0';
  
  setTimeout(() => {
    ouvrirFiche(id);
    contenu.style.transition = 'none';
    contenu.style.transform = `translateX(${direction * 100}px)`;
    void contenu.offsetWidth; // force reflow
    
    contenu.style.transition = 'transform 0.2s cubic-bezier(.18, 1.35, .35, 1), opacity 0.2s';
    contenu.style.transform = 'translateX(0)';
    contenu.style.opacity = '1';
    
    setTimeout(() => {
      contenu.style.transition = '';
      contenu.style.transform = '';
      contenu.style.opacity = '';
    }, 200);
  }, 150);
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
    ? t('ajout.voixHintSpirit')
    : t('ajout.voixHint');
  // Texte, voix, photo et fiche (formulaire) sont disponibles pour les vins
  // comme pour les spiritueux — le formulaire affiché dépend de la catégorie.
  const montrerModes = () => {
    $('#modes-ajout [data-mode="forme"]').hidden = false;
    const actif = $('#modes-ajout .seg.actif')?.dataset.mode || 'photo';
    ['texte', 'voix', 'photo'].forEach((m) => { $(`#panneau-${m}`).hidden = m !== actif; });
    $('#panneau-spiritueux').hidden = !(catAjout === 'spiritueux' && actif === 'forme');
    $('#panneau-fiche-vin').hidden = !(catAjout === 'vin' && actif === 'forme');
    $('#saisie-texte').placeholder = catAjout === 'spiritueux'
      ? t('ajout.textePlaceholderSpirit')
      : t('ajout.textePlaceholder');
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
  $('#fv-couleur').innerHTML = optionsListe(COULEURS, 'Rouge', 'couleur');
  $('#fv-format').innerHTML = optionsListe(FORMATS, '75 cl');
  brancherSelectsRegion($('#panneau-fiche-vin'));
  $('#btn-analyser-fiche-vin').onclick = () => {
    const nom = $('#fv-nom').value.trim();
    const appellation = $('#fv-appellation').value.trim();
    if (!nom && !appellation) return toast(t('ajout.erreurNom'));
    const millesime = parseInt($('#fv-mil').value) || null;
    const region = $('#fv-region').value;
    const couleur = $('#fv-couleur').value;
    aAjouter = [{
      nom: nom || appellation,
      domaine: $('#fv-domaine').value.trim(),
      appellation: appellation || null,
      pays: $('#fv-pays').value, region, couleur, millesime,
      format: $('#fv-format').value || '75 cl',
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
      let photoOrig = null;
      try {
        const { base64, type, dataUrl } = await compresser(fichiers[i]);
        // On garde la vraie photo prise (vignette légère) comme image de la bouteille
        photoOrig = await compresserDataUrl(dataUrl, 680, 0.8);
        if (spirit) {
          const r = await analyserEtiquetteSpirit(apiKey, base64, type);
          lus.push({
            categorie: 'spiritueux',
            type: TYPES_SPIRITUEUX.includes(r.type) ? r.type : 'Autre',
            domaine: r.marque || '', nom: r.nom || r.type || 'Spiritueux',
            age: r.age || null, alcool: r.alcool || null,
            pays: r.pays || null, format: '75 cl', prix: null, qty: 1, photoOrig,
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
            alcool: r.alcool || null, prix: null, qty: 1, ...g, photoOrig,
          });
        }
      } catch (err) {
        toast(`Photo ${i + 1} illisible (${err.message}) — fiche vide à compléter`);
        const base = spirit ? parseLigneSpirit('Spiritueux à identifier') : parseLigne('Vin à identifier');
        if (photoOrig) base.photoOrig = photoOrig; // on garde quand même la photo
        lus.push(base);
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
  return { base64: dataUrl.split(',')[1], type: 'image/jpeg', dataUrl };
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
    if (valid) valid.textContent = t('ajout.valider').replace('{n}', reste);
  });
}

function rendreApercu() {
  if (!aAjouter.length) { $('#apercu-ajout').innerHTML = ''; return; }
  $('#apercu-ajout').innerHTML = aAjouter.map((b, i) => `
    <div class="apercu" data-i="${i}">
      <div class="apercu-tete"><h4>${t('ajout.previewVin')} ${aAjouter.length > 1 ? i + 1 : ''}</h4><button class="apercu-suppr" data-rm="${i}" title="Ne pas ajouter cette bouteille">${t('ajout.retirer')}</button></div>
      <div class="ligne">
        <div style="flex:2"><label>${t('fiche.nom')}</label><input data-k="nom" value="${esc(b.nom)}"></div>
        <div style="flex:.8"><label>${t('fiche.millesime')}</label><input data-k="millesime" type="number" value="${b.millesime || ''}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>${t('fiche.domaine')}</label><input data-k="domaine" value="${esc(b.domaine || '')}"></div>
        <div style="flex:1"><label>${t('fiche.appellation')}</label><input data-k="appellation" value="${esc(b.appellation || '')}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>${t('fiche.pays')}</label><select data-k="pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
        <div style="flex:1"><label>${t('fiche.region')}</label><select data-k="region" data-region>${optionsRegion(b.region, b.pays || 'France')}</select></div>
        <div style="flex:1"><label>${t('fiche.couleur')}</label><select data-k="couleur">${optionsListe(COULEURS, b.couleur, 'couleur')}</select></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>${t('fiche.prix')}</label><input data-k="prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
        <div style="flex:1"><label>${t('fiche.quantite')}</label><input data-k="qty" type="number" min="1" value="${b.qty}"></div>
      </div>
      <details class="plus-details">
        <summary>${t('ajout.plusDetails')}</summary>
        <div class="ligne">
          <div style="flex:1.4"><label>${t('fiche.cepages')}</label><input data-k="cepages" value="${esc(Array.isArray(b.cepages) ? b.cepages.join(', ') : (b.cepages || ''))}" placeholder="grenache, syrah…"></div>
          <div style="flex:1"><label>${t('fiche.format')}</label><select data-k="format">${optionsListe(FORMATS, b.format || '75 cl')}</select></div>
          <div style="flex:.7"><label>${t('fiche.alcool')}</label><input data-k="alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
        </div>
      </details>
      <p class="statut-enrich">${esc(b.prixInfo || '')}</p>
      <div class="ligne"><div style="flex:1"><label>Fiche</label><textarea data-k="description" rows="3" placeholder="${t('ajout.placeholderDesc')}">${esc(b.description || '')}</textarea></div></div>
    </div>`).join('') +
    `<p class="note-ia" style="text-align:left;margin:10px 2px 0">${t('ajout.relecture')}</p>
    <button class="btn-or btn-large" id="btn-confirmer-ajout">${t('ajout.valider').replace('{n}', aAjouter.length)}</button>`;
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
      <div class="apercu-tete"><h4>${ico('flacon', 15)} ${t('ajout.previewSpirit')} ${aAjouter.length > 1 ? i + 1 : ''}</h4><button class="apercu-suppr" data-rm="${i}" title="Ne pas ajouter ce spiritueux">${t('ajout.retirer')}</button></div>
      <div class="ligne">
        <div style="flex:1"><label>${t('spirit.type')}</label><select data-k="type">${optionsListe(TYPES_SPIRITUEUX, b.type)}</select></div>
        <div style="flex:1.3"><label>${t('spirit.marque')}</label><input data-k="domaine" value="${esc(b.domaine || '')}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1.6"><label>${t('spirit.nom')}</label><input data-k="nom" value="${esc(b.nom || '')}"></div>
        <div style="flex:.7"><label>${t('spirit.age')}</label><input data-k="age" type="number" min="0" value="${b.age ?? ''}"></div>
        <div style="flex:.7"><label>${t('fiche.alcool')}</label><input data-k="alcool" type="number" step="0.1" value="${b.alcool ?? ''}"></div>
      </div>
      <div class="ligne">
        <div style="flex:1"><label>${t('fiche.pays')}</label><select data-k="pays" data-pays>${optionsPays(b.pays || 'France')}</select></div>
        <div style="flex:.8"><label>${t('fiche.prix')}</label><input data-k="prix" type="number" step="0.5" value="${b.prix ?? ''}"></div>
        <div style="flex:.7"><label>${t('fiche.quantite')}</label><input data-k="qty" type="number" min="1" value="${b.qty}"></div>
      </div>
      <div class="bloc-niveau">
        <label>${t('ajout.niveauRestant')} <b class="niveau-val">${b.niveau ?? 100} %</b> <small style="color:var(--creme-45)">${t('ajout.dejaOuverte')}</small></label>
        <input data-k="niveau" type="range" min="0" max="100" step="5" value="${b.niveau ?? 100}">
      </div>
      <p class="statut-enrich">${esc(b.prixInfo || '')}</p>
      <div class="ligne"><div style="flex:1"><label>Fiche</label><textarea data-k="description" rows="3" placeholder="${t('ajout.placeholderDescSpirit')}">${esc(b.description || '')}</textarea></div></div>
    </div>`).join('') +
    `<p class="note-ia" style="text-align:left;margin:10px 2px 0">${t('ajout.relecture')}</p>
    <button class="btn-or btn-large" id="btn-confirmer-ajout">${t('ajout.valider').replace('{n}', aAjouter.length)}</button>`;
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
    statut(t('ajout.rechercheWeb'));
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
  vibrer('succes');
  toast(t('ajout.toastEntree').replace('{n}', n));
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

/* ═══ SOMMELIER — vocal d'abord, autour de l'orbe ═══ */
let orbe = null;
let dicteeEnCours = null;
const STATUT_REPOS = 'Touchez le micro et dites votre repas';

let budgetMax = null; // plafond de prix pour la sélection (null = libre)
function majBudget(v) {
  budgetMax = v >= 210 ? null : v;
  $('#budget-aff').textContent = budgetMax ? `≤ ${budgetMax} €` : t('somm.budgetLibre');
}

const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const statutOrbe = (txt) => { $('#orbe-statut').textContent = txt; };

/* Historique des 3 dernières demandes, rappelables d'un tap */
/* Sous-titres streamés : on écrit, puis on colle le défilement en bas —
   seules les deux dernières lignes restent visibles, comme au cinéma
   (l'utilisateur peut remonter au doigt pour relire). */
function majTranscript(txt) {
  const el = $('#orbe-transcript');
  el.textContent = txt;
  el.scrollTop = el.scrollHeight;
}

const HISTO_CLE = 'caveau:repas-recents';
const lireHisto = () => { try { return JSON.parse(localStorage.getItem(HISTO_CLE)) || []; } catch { return []; } };
function pousserHisto(q) {
  localStorage.setItem(HISTO_CLE, JSON.stringify([q, ...lireHisto().filter((x) => x !== q)].slice(0, 3)));
}

/* Inspirations : des plats suggérés selon les couleurs réellement en cave */
const INSPIRATIONS = {
  rouge: ['somm.inspi.boeuf', 'somm.inspi.fromages', 'somm.inspi.gibier'],
  blanc: ['somm.inspi.saumon', 'somm.inspi.poulet', 'somm.inspi.sushi'],
  'rosé': ['somm.inspi.bbq', 'somm.inspi.pizza', 'somm.inspi.tajine'],
  effervescent: ['somm.inspi.apero', 'somm.inspi.huitres'],
  moelleux: ['somm.inspi.raclette', 'somm.inspi.fromages'],
};
function rendreSommelier() {
  // naissance paresseuse de la simulation : l'écran est maintenant visible,
  // le canvas a sa vraie taille — l'init WebGL part sur des bases saines
  if (!orbe) {
    orbe = creerOrbe($('#orbe'));
    window.__orbe = orbe; // poignée de debug
  }
  orbe.reveiller(); // éclaboussure de bienvenue à chaque visite
  const enCave = vinsSeuls(store.get().bottles).filter((b) => b.qty > 0);
  const couleurs = [...new Set(enCave.map((b) => String(b.couleur || '').toLowerCase()))];
  const plats = [...new Set(couleurs.flatMap((c) => INSPIRATIONS[c] || []))].slice(0, 6);
  $('#chips-inspi').innerHTML = plats.map((p) => `<button class="chip-inspi" data-cle="${p}">${esc(t(p))}</button>`).join('');
  $('#chips-inspi').querySelectorAll('.chip-inspi').forEach((el) => {
    el.onclick = () => { vibrer('tic'); lancerConseil(el.textContent); };
  });
  if (!voixDisponible) statutOrbe(t('somm.ecrireRepas'));
  rendreHisto();
}
function rendreHisto() {
  $('#historique-sommelier').innerHTML = lireHisto()
    .map((q) => `<button class="chip-histo">${esc(q)}</button>`).join('');
  $('#historique-sommelier').querySelectorAll('.chip-histo').forEach((el) => {
    el.onclick = () => lancerConseil(el.textContent);
  });
}

const MAT_LABELS = { apogee: t('mat.apogee'), urgent: t('mat.urgent'), approche: t('mat.approche'), jeune: t('mat.jeune'), passe: t('mat.passe') };
function carteReco(c, i, profil) {
  const b = c.bottle;
  const pct = pctAccord(c.score);
  const m = c.maturite;
  const couleur = String(b.couleur || t('couleur.rouge')).toLowerCase().replace(/\s+/g, '-');
  // r=24 → circonférence = 2π×24 ≈ 151 ; dashoffset 0 = plein, 151 = vide
  const offset = 151 - Math.round(151 * pct / 100);
  return `
    <div class="reco ${i === 0 ? 'premier' : ''} reco-c-${esc(couleur)}" data-id="${b.id}">
      ${i === 0 ? `<div class="reco-ruban">${t('somm.accordParfait')}</div>` : ''}
      <div class="reco-tete">
        <div class="reco-corps">
          <div class="reco-nom">${esc(b.nom)}${b.millesime ? ` <span class="mil">${b.millesime}</span>` : ''}</div>
          <div class="carte-meta">${esc(b.region)} · ${esc(t('couleur.' + String(b.couleur || '').toLowerCase().replace(/\s+/g, '-')) || b.couleur)}${b.prix ? ` · ${b.prix} €` : ''} · ×${b.qty}</div>
          ${m && MAT_LABELS[m.code] ? `<span class="cachet cachet-${m.code}">${MAT_LABELS[m.code]}</span>` : ''}
        </div>
        <div class="reco-anneau" title="${pct}% d'accord avec votre demande">
          <svg viewBox="0 0 60 60" width="60" height="60">
            <circle class="fond" cx="30" cy="30" r="24"/>
            <circle class="jauge" cx="30" cy="30" r="24" stroke-dasharray="151" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="reco-pct"><b>${pct}%</b><small>${t('somm.accord')}</small></div>
        </div>
      </div>
      <div class="reco-texte">${esc(argumentaire(c, profil, i))}</div>
      <div class="reco-actions">
        <button data-act="sortir">${ico('verre', 13)} ${t('somm.jeLaSors')}</button>
        <button data-act="fiche">${ico('fiche', 13)} ${t('somm.voirFiche')}</button>
      </div>
    </div>`;
}
function brancherActionsReco(zone) {
  zone.querySelectorAll('.reco').forEach((el) => {
    // toute la carte ouvre la fiche ; les boutons gardent leurs actions
    el.onclick = () => ouvrirFiche(el.dataset.id);
    el.style.cursor = 'pointer';
    const sortir = el.querySelector('[data-act="sortir"]');
    const fiche = el.querySelector('[data-act="fiche"]');
    if (sortir) sortir.onclick = (e) => { e.stopPropagation(); dialogueSortie(el.dataset.id); };
    if (fiche) fiche.onclick = (e) => { e.stopPropagation(); ouvrirFiche(el.dataset.id); };
  });
}

/* Fin de cycle : l'orbe se condense pour laisser la scène aux bouteilles */
function orbeAuRepos(compacte = true) {
  orbe?.etatVers('repos');
  statutOrbe(compacte ? t('somm.toucherMicro') : t('somm.repos'));
  $('#orbe-scene').classList.toggle('compacte', compacte);
}

/* Une question dépasse l'accord mets-vins ? Le Sommelier+ (IA) prend la main. */
const estQuestionLibre = (q) => q.length > 70 || /\?|€|euros?|personnes|budget|combien|comment|pourquoi|conserv|carafe|températur/i.test(q);

async function escaladerIA(q) {
  const zone = $('#resultats-sommelier');
  orbe?.etatVers('reflexion');
  statutOrbe(t('somm.chargementPlus'));
  zone.innerHTML = '<div class="reco-squelette"><span class="photo-shimmer"></span></div>';
  try {
    const rep = await sommelierPlus(store.get().settings.apiKey, q, store.get().bottles);
    zone.innerHTML = `<div class="bulle-ia">${esc(rep)}</div>`;
    vibrer('succes');
    dire(rep);
  } catch (e) { zone.innerHTML = ''; toast(e.message); }
  orbeAuRepos();
}

async function lancerConseil(repas) {
  repas = (repas || '').trim();
  if (!repas) return toast(t('ajout.erreurVide'));
  const enCave = vinsSeuls(store.get().bottles).filter((b) => b.qty > 0);
  if (!enCave.length) return toast(t('somm.caveVide'));
  pousserHisto(repas);
  majTranscript(repas);
  const { apiKey, voixActive } = store.get().settings;

  // Question libre (budget, nombre de convives, conservation…) → IA directement
  if (apiKey && estQuestionLibre(repas)) return escaladerIA(repas);

  const zone = $('#resultats-sommelier');
  orbe?.etatVers('reflexion');

  // Calcul du résultat AVANT l'animation pour pré-chauffer le TTS pendant l'attente
  const { profil, choix } = recommander(repas, enCave, occasion, 3, undefined, budgetMax);

  if (!profil.plat) {
    if (apiKey) return escaladerIA(repas);
    
    zone.innerHTML = `<div class="vide"><div class="gros">${t('somm.incompris')}</div></div>`;
    orbeAuRepos();
    dire(t('somm.incompris'));
    return;
  }

  if (!choix.length) {
    if (budgetMax) {
      const sansPlafond = recommander(repas, enCave, occasion, 1);
      if (sansPlafond.choix.length) {
        zone.innerHTML = `<div class="vide"><div class="gros">${t('somm.rienBudget').replace('{v}', budgetMax)}</div>Le ${esc(sansPlafond.choix[0].bottle.nom)} serait parfait — élargissez le budget d'un cran ?</div>`;
        orbeAuRepos();
        return;
      }
    }
    if (apiKey) return escaladerIA(repas);
    zone.innerHTML = `<div class="vide"><div class="gros">${t('somm.rienCave')}</div>Pour ${esc(profil.plat || 'ce plat')}, je chercherais un ${Object.entries(profil.cible).sort((a, z) => z[1] - a[1])[0][0]} ${profil.regions[0] ? 'de ' + profil.regions[0] : ''}. L'occasion d'un achat ?</div>`;
    orbeAuRepos();
    return;
  }

  // Argumentaires locaux instantanés (affichés tout de suite, sans attendre
  // le réseau). Ils servent aussi de repli si l'IA échoue.
  const argLocaux = choix.map((c, i) => argumentaire(c, profil, i));

  // En parallèle, dès maintenant : l'IA rédige des argumentaires personnalisés
  // (vraie prise de position, n°1 vs n°2 vs n°3). Ils remplaceront le texte des
  // cartes dès qu'ils arrivent. Le repli local reste affiché si ça échoue.
  const recosIA = apiKey
    ? argumenterRecos(apiKey, repas, occasion, choix, budgetMax).catch(() => null)
    : Promise.resolve(null);

  // Pré-chargement audio du n°1 (texte local) : la requête TTS part pendant
  // l'animation → voix quasi instantanée à l'affichage des cartes.
  const synthFn = apiKey ? (t) => synthVoixGemini(apiKey, t) : null;
  const blobPromise = voixActive && synthFn
    ? synthFn(argLocaux[0]).catch(() => null)
    : Promise.resolve(null);

  // Petite mise en scène
  if (!reduitMouvement()) {
    statutOrbe(t('somm.chargement'));
    zone.innerHTML = '<div class="reco-squelette"><span class="photo-shimmer"></span></div>'.repeat(2);
    await attendre(600);
    statutOrbe(t('somm.chargementRemonte'));
    await attendre(400);
  }

  zone.innerHTML = choix.map((c, i) => carteReco(c, i, profil)).join('');
  brancherActionsReco(zone);
  if (apiKey) {
    zone.insertAdjacentHTML('beforeend',
      `<button class="btn-discret" id="btn-approfondir" style="display:block;margin:10px auto 0">${ico('etincelles', 13)} ${t('somm.approfondir')}</button>`);
    $('#btn-approfondir').onclick = () => escaladerIA(`${repas} — détaille le service (température, carafage) et propose une alternative.`);
  }
  rendreHisto();
  // Compact la scène ; l'orbe passera en 'parle' puis 'repos' via dire()
  $('#orbe-scene').classList.add('compacte');
  statutOrbe(t('somm.toucherMicro'));
  vibrer('succes');
  defilerVersResultats(zone);

  // Voix : on joue dès que possible.
  // On passe la promesse directement à dire() qui va faire un Promise.race
  // avec un timeout pour s'assurer que la voix démarre très vite.
  if (voixActive) {
    dire(argLocaux[0], blobPromise);
  } else {
    orbe?.etatVers('repos');
  }

  // Quand les argumentaires IA arrivent, on remplace le texte de chaque carte
  // en douceur (fondu). La voix a déjà donné le ton ; le texte affine.
  recosIA.then((textes) => {
    if (!textes) return;
    const cartes = $('#resultats-sommelier').querySelectorAll('.reco-texte');
    textes.forEach((txt, i) => {
      const el = cartes[i];
      if (!el || !txt) return;
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = txt; el.style.opacity = '1'; }, 250);
    });
  });
}

/* Amène les cartes sous les yeux, quoi qu'il arrive : boucle de convergence
   qui corrige la position toutes les 180 ms jusqu'à stabilité (la scène se
   condense, dvh fluctue, la barre du navigateur bouge — aucun instant unique
   n'est fiable). S'arrête dès que c'est calé, ou dès que l'utilisateur touche
   l'écran : sa main reprend toujours la priorité. */
function defilerVersResultats(zone) {
  const MARGE = 64; // l'en-tête reste visible au-dessus de la première carte
  let tours = 0;
  let stables = 0;
  const arreter = () => {
    clearInterval(boucle);
    window.removeEventListener('touchstart', arreter);
    window.removeEventListener('wheel', arreter);
  };
  const boucle = setInterval(() => {
    tours++;
    const ecart = zone.getBoundingClientRect().top - MARGE;
    if (Math.abs(ecart) > 8) { stables = 0; window.scrollBy({ top: ecart, behavior: 'auto' }); }
    else stables++;
    if (stables >= 3 || tours >= 14) arreter();
  }, 180);
  window.addEventListener('touchstart', arreter, { passive: true });
  window.addEventListener('wheel', arreter, { passive: true });
}

function initSommelier() {
  // La simulation n'est PAS créée ici : l'écran est encore caché, donc le
  // canvas a une taille nulle (famille entière de bugs d'init WebGL).
  // Elle naît à la première ouverture de l'écran — voir rendreSommelier().

  $('#occasions').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    occasion = s.dataset.occ;
    $('#occasions').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
  });

  // LE bouton micro : on écoute. Re-tap : on arrête. Sans micro : le texte.
  // (Le tap sur l'encre ne déclenche rien : la sim capture le toucher pour
  // les remous et avale le click sur Android — le doigt sert à jouer.)
  $('#btn-micro-sommelier').onclick = () => {
    if (!orbe || orbe.etat === 'reflexion') return;
    if (orbe.etat === 'ecoute') { try { dicteeEnCours?.stop(); } catch { } return; }
    if (!voixDisponible) { basculerEcrire(true); return; }
    vibrer('tic');
    $('#orbe-scene').classList.remove('compacte');
    majTranscript('');
    statutOrbe('Je vous écoute…');
    orbe.ecouter();
    let texteFinal = '';
    dicteeEnCours = dicter({
      // écoute continue : la fin de phrase n'est conclue qu'après un vrai
      // silence — le sommelier ne coupe plus la parole
      continu: true,
      silenceMs: 1800,
      onResult: (txt) => {
        // chaque fragment reconnu fait réagir la matière (essentiel sur
        // Android, où l'amplitude micro n'est pas accessible pendant la dictée)
        const croissance = txt.length - texteFinal.length;
        if (croissance > 0) orbe.impulsionVoix(Math.min(1, croissance / 14));
        texteFinal = txt;
        majTranscript(txt);
      },
      onEnd: () => {
        dicteeEnCours = null;
        if (texteFinal) lancerConseil(texteFinal);
        else orbeAuRepos(false);
      },
      onError: (m) => { toast(m); orbeAuRepos(false); },
    });
  };

  // Budget : à fond = libre, sinon plafond strict pour la sélection
  const budgetSauve = parseInt(localStorage.getItem('caveau:budget')) || 210;
  $('#budget-max').value = budgetSauve;
  majBudget(budgetSauve);
  $('#budget-max').oninput = (e) => {
    const v = parseInt(e.target.value);
    localStorage.setItem('caveau:budget', String(v));
    majBudget(v);
  };

  $('#lien-ecrire').onclick = () => basculerEcrire();
  $('#btn-conseiller').onclick = () => lancerConseil($('#saisie-repas').value);
  $('#saisie-repas').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); lancerConseil(e.target.value); }
  });

  $('#btn-surprise').onclick = () => {
    const enCave = vinsSeuls(store.get().bottles).filter((b) => b.qty > 0);
    if (!enCave.length) return toast(t('somm.caveVide'));
    const b = surprise(enCave);
    const m = maturite(b);
    $('#orbe-scene').classList.add('compacte');
    const cSurp = String(b.couleur || 'rouge').toLowerCase().replace(/\s+/g, '-');
    $('#resultats-sommelier').innerHTML = `
      <div class="reco premier reco-c-${esc(cSurp)}" data-id="${b.id}">
        <div class="reco-ruban">${t('somm.surpriseTitre')}</div>
        <div class="reco-tete">
          <div class="reco-corps">
            <div class="reco-nom">${esc(b.nom)}${b.millesime ? ` <span class="mil">${b.millesime}</span>` : ''}</div>
            <div class="carte-meta">${esc(b.region)} · ${esc(t('couleur.' + String(b.couleur || '').toLowerCase().replace(/\s+/g, '-')) || b.couleur)}${b.prix ? ` · ${b.prix} €` : ''}</div>
            ${MAT_LABELS[m.code] ? `<span class="cachet cachet-${m.code}">${MAT_LABELS[m.code]}</span>` : ''}
          </div>
        </div>
        <div class="reco-texte">${m.code === 'urgent' ? t('somm.surpriseUrgente') : m.code === 'apogee' ? t('somm.surpriseApogee') : t('somm.surpriseDecouverte')}</div>
        <div class="reco-actions">
          <button data-act="sortir">${ico('verre', 13)} ${t('somm.jeLaSors')}</button>
          <button data-act="encore">${ico('de', 13)} ${t('somm.surpriseRelancer')}</button>
        </div>
      </div>`;
    const el = $('#resultats-sommelier .reco');
    el.querySelector('[data-act="sortir"]').onclick = () => dialogueSortie(b.id);
    el.querySelector('[data-act="encore"]').onclick = () => $('#btn-surprise').click();
    dire(`Ce soir, je vous propose le ${b.nom} ${b.millesime || ''}.`);
  };
}

function basculerEcrire(forcer) {
  const bloc = $('#bloc-ecrire');
  const ouvrir = forcer ?? bloc.hidden;
  bloc.hidden = !ouvrir;
  if (ouvrir) {
    bloc.scrollIntoView({ behavior: reduitMouvement() ? 'auto' : 'smooth', block: 'center' });
    $('#saisie-repas').focus();
  }
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
    html = `<div class="vide"><div class="gros">${t('alertes.toutVaBien')}</div>${t('alertes.creerVeilles')}</div>`;
  }
  
  const aBoire = [...urgentes, ...aFinir];
  if (aBoire.length) {
    html += `<div class="groupe-titre" style="margin-top:0">${t('alertes.groupeABoire')}</div>` + aBoire.map(carteHTML).join('');
  }
  
  if (epuisees.length) {
    html += `<div class="groupe-titre">${t('alertes.groupeEpuisees')}</div>` + epuisees.map(carteHTML).join('');
  }
  
  if (basses.length) {
    html += `<div class="groupe-titre">${t('alertes.groupeStocksBas')}</div>`;
    basses.forEach(({ w, n }) => {
      const lib = w.type === 'reference' ? (bottles.find((b) => b.id === w.valeur)?.nom || t('alertes.reference')) : w.valeur;
      const q = w.type === 'reference' ? (bottles.find((b) => b.id === w.valeur)?.nom || '') : `vin ${w.valeur}`;
      html += `<div class="alerte douce"><div style="flex:1">
        <div class="alerte-titre">${t('alertes.stockBas').replace('{lib}', esc(lib))}</div>
        <div class="alerte-detail">${t('alertes.stockDetail').replace('{qty}', n).replace('{seuil}', w.seuil)}</div>
        <div class="liens-rachat">
          <a href="https://www.wine-searcher.com/find/${encodeURIComponent(q)}" target="_blank" rel="noopener">Wine-Searcher ↗</a>
          <a href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q + ' promo')}" target="_blank" rel="noopener">Promos ↗</a>
        </div>
      </div></div>`;
    });
  }

  $('#liste-alertes').innerHTML = html;
  cascade($('#liste-alertes'));
  $('#liste-alertes').querySelectorAll('.carte').forEach((c) => c.onclick = () => ouvrirFiche(c.dataset.id));

  // Liste des veilles
  const { watches } = store.get();
  $('#liste-veilles').innerHTML = watches.length ? watches.map((w) => {
    const n = compterVeille(w, bottles);
    const lib = w.type === 'reference' ? (bottles.find((b) => b.id === w.valeur)?.nom || t('alertes.refSupprimee')) : w.valeur;
    return `<div class="veille-item">
      <span>${{ region: '🗺️', millesime: '📅', reference: '🍾' }[w.type]} ${esc(lib)}</span>
      <span><span class="${n <= w.seuil ? 'bas' : 'ok'}">${n}</span> / seuil ${w.seuil}
      <button class="btn-discret" data-id="${w.id}" style="padding:2px 6px">✕</button></span>
    </div>`;
  }).join('') : `<p style="color:var(--creme-45);font-size:13px">${t('alertes.aucuneVeille')}</p>`;
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
  $('#veille-valeur-slot').innerHTML = `<select id="veille-valeur">${opts || `<option value="">${t('alertes.rienEnCave')}</option>`}</select>`;
}

function initAlertes() {
  $('#veille-type').onchange = majSlotVeille;
  $('#forme-veille').onsubmit = (e) => {
    e.preventDefault();
    const valeur = $('#veille-valeur')?.value;
    if (!valeur) return toast(t('alertes.rienAVeiller'));
    store.ajouterVeille({ type: $('#veille-type').value, valeur, seuil: parseInt($('#veille-seuil').value) || 1 });
    rendreAlertes(); majBadgeAlertes(); toast(t('alertes.toastVeille'));
  };
}

/* ═══ Thème ═══ */
function appliquerTheme(theme) {
  document.documentElement.dataset.theme = theme === 'clair' ? 'clair' : 'sombre';
  // la barre système (Android) suit le décor
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'clair' ? '#f2e9d7' : '#120a0d');
}

/* ═══ STATS ═══ */
let vueStats = 'chiffres';
let mappemonde = null; // instance de la carte, créée à la première ouverture

async function rendreCarte() {
  $('#contenu-stats').hidden = true;
  $('#contenu-carte').hidden = false;
  if (!mappemonde) {
    // import paresseux : le fond de carte (~115 Ko) n'est chargé qu'ici
    const { creerCarte } = await import('./carte.js');
    mappemonde = creerCarte($('#contenu-carte'), {
      surFiche: (id) => ouvrirFiche(id),
      surCave: (region) => {
        $('#recherche').value = region;
        catCave = 'vin';
        montrerEcran('cave');
      },
    });
  }
  mappemonde.rendre(vinsSeuls(store.get().bottles).filter((b) => b.qty > 0));
}

function rendreStats() {
  if (vueStats === 'carte') { rendreCarte(); return; }
  $('#contenu-carte').hidden = true;
  $('#contenu-stats').hidden = false;
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
      <div><div class="v" id="stat-nb">${nb}</div><div class="l">${t('stats.bouteilles')}</div></div>
      <div id="cellule-valeur-stats" title="Toucher pour masquer/afficher"><div class="v" id="stat-valeur">${valeurTxt}</div><div class="l">${t('stats.valeurCave')} ${settings.valeurCachee ? '👁' : ''}</div></div>
      <div><div class="v" id="stat-refs">${enCave.length}</div><div class="l">${t('stats.references')}</div></div>
    </div>
    <div class="stat-bloc"><h3 class="sous-titre">${t('stats.parCouleur')}</h3>${jauges(parGroupe(vins, 'couleur')) || '—'}</div>
    <div class="stat-bloc"><h3 class="sous-titre">${t('stats.parRegion')}</h3>${jauges(parGroupe(vins, 'region'))}</div>
    <div class="stat-bloc"><h3 class="sous-titre">${t('stats.pyramide')}</h3>${jauges(parGroupe(vins, 'millesime').sort((a, z) => String(z[0]).localeCompare(String(a[0]))), true)}</div>
    ${spirits.length ? `<div class="stat-bloc"><h3 class="sous-titre">${t('stats.parType')}</h3>${jauges(parGroupe(spirits, 'type'))}</div>` : ''}
    <div class="stat-bloc"><h3 class="sous-titre">${t('stats.dernieresSorties')}</h3>
      ${sorties.map((s) => `<div class="journal-item"><span>${ico('verre', 12)} ${esc(s.nom)} ${s.millesime || ''}${s.occasion ? ` — <i>${esc(s.occasion)}</i>` : ''}</span><span class="quand">${s.date}</span></div>`).join('') || `<p style="color:var(--creme-45);font-size:13px">${t('stats.aucuneSortie')}</p>`}
    </div>`;

  $('#cellule-valeur-stats').onclick = () => {
    store.majSettings({ valeurCachee: !store.get().settings.valeurCachee });
    rendreStats();
  };

  // Chiffres qui montent + jauges qui se remplissent en cascade (l'animation
  // CSS `remplir` se déclenche à l'insertion, on ne fait qu'étaler les départs).
  compterVers($('#stat-nb'), nb);
  compterVers($('#stat-refs'), enCave.length);
  if (!settings.valeurCachee) compterVers($('#stat-valeur'), Math.round(valeur), ' €');
  $('#contenu-stats').querySelectorAll('.rempli').forEach((r, i) => {
    r.style.animationDelay = `${Math.min(i * 45, 500)}ms`;
  });
}

/* ═══ PROFIL UTILISATEUR ═══ */
// Initiales pour l'avatar : à partir du nom, sinon de l'email, sinon « ? ».
function initiales(s) {
  const n = (s.nom || '').trim();
  if (n) return n.split(/\s+/).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
  const e = (s.email || '').trim();
  return e ? e[0].toUpperCase() : '?';
}

// Met à jour la pastille avatar de l'en-tête (initiales ou photo).
export function majAvatar() {
  const s = store.get().settings;
  const el = $('#avatar-entete');
  if (!el) return;
  if (s.avatar) {
    el.classList.add('a-photo');
    el.style.backgroundImage = `url("${s.avatar}")`;
    el.querySelector('#avatar-init').textContent = '';
  } else {
    el.classList.remove('a-photo');
    el.style.backgroundImage = '';
    el.querySelector('#avatar-init').textContent = initiales(s);
  }
}

const AVANTAGES_PREMIUM = [
  () => t('premium.0'),
  () => t('premium.1'),
  () => t('premium.2'),
  () => t('premium.3'),
];

function rendreProfil() {
  const s = store.get().settings;
  const av = s.avatar
    ? `<span class="profil-avatar a-photo" style="background-image:url('${s.avatar}')"></span>`
    : `<span class="profil-avatar">${initiales(s)}</span>`;
  const premium = s.plan === 'premium';

  $('#contenu-profil').innerHTML = `
    <div class="profil-tete">
      <button class="profil-avatar-edit" id="p-avatar-btn" aria-label="Changer la photo">
        ${av}<span class="profil-avatar-cam">${ico('photo', 13)}</span>
      </button>
      <input type="file" id="p-avatar-input" accept="image/*" hidden>
      <div class="profil-nom-aff">${esc(s.nom || t('profil.votreNom'))}</div>
      <div class="profil-email-aff">${esc(s.email || t('profil.votreEmail'))}</div>
      <span class="profil-plan-pastille ${premium ? 'pre' : ''}">${premium ? t('profil.premium') : t('profil.gratuit')}</span>
    </div>

    <div class="profil-bloc">
      <h3 class="sous-titre">${t('profil.identite')}</h3>
      <div class="ligne-form">
        <div style="flex:1"><label>${t('profil.nom')}</label><input id="p-nom" placeholder="Xavier Galezowski" value="${esc(s.nom)}"></div>
      </div>
      <div class="ligne-form">
        <div style="flex:1"><label>${t('profil.email')}</label><input id="p-email" type="email" placeholder="vous@email.com" value="${esc(s.email)}"></div>
      </div>
      <button class="btn-or" id="p-save-identite">${t('profil.enregistrerProfil')}</button>
    </div>

    <div class="profil-bloc carte-offre ${premium ? 'pre' : ''}">
      <div class="offre-tete">
        <div>
          <div class="offre-titre">${premium ? t('profil.somPremium') : t('profil.somGratuit')}</div>
          <div class="offre-sous">${premium ? t('profil.merciPremium') : t('profil.invitePremium')}</div>
        </div>
        <div class="offre-prix">${premium ? '✓' : t('profil.prixPremium')}</div>
      </div>
      <ul class="offre-avantages">
        ${AVANTAGES_PREMIUM.map((a) => `<li>${esc(a())}</li>`).join('')}
      </ul>
      ${premium
        ? `<button class="btn-fantome" id="p-plan-toggle">${t('profil.revenirGratuit')}</button>`
        : `<button class="btn-or btn-large" id="p-plan-toggle">${ico('etincelles', 15)} ${t('profil.passerPremium')}</button>`}
    </div>

    <div class="profil-bloc">
      <h3 class="sous-titre">${t('profil.preferences')}</h3>
      <label class="ligne-toggle">
        <span>${t('profil.voixActive')}</span>
        <input type="checkbox" id="p-voix" ${s.voixActive ? 'checked' : ''}>
      </label>
      <label class="ligne-toggle">
        <span>${t('profil.masquerValeur')}</span>
        <input type="checkbox" id="p-valeur" ${s.valeurCachee ? 'checked' : ''}>
      </label>
      <label class="ligne-toggle">
        <span>${t('profil.themeClair')}</span>
        <input type="checkbox" id="p-theme" ${s.theme === 'clair' ? 'checked' : ''}>
      </label>
      <div class="ligne-form" style="margin-top:16px;">
        <div style="flex:1">
          <label>${t('profil.langue')}</label>
          <select id="p-lang">
            <option value="fr" ${s.lang === 'fr' ? 'selected' : ''}>Français</option>
            <option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option>
            <option value="es" ${s.lang === 'es' ? 'selected' : ''}>Español (Paraguay)</option>
          </select>
        </div>
      </div>
      <details class="avance" ${s.apiKey ? '' : ''}>
        <summary>${t('profil.avanceCle')}</summary>
        <label class="aide-champ">${t('profil.cleDescription')}</label>
        <input id="p-api" type="password" placeholder="${t('profil.clePlaceholder')}" value="${esc(s.apiKey)}">
        <button class="btn-sombre" id="p-save-api" style="width:100%;margin-top:8px">${t('profil.enregistrerCle')}</button>
      </details>
    </div>

    <div class="profil-bloc">
      <h3 class="sous-titre">${t('profil.mesDonnees')}</h3>
      <button class="btn-fantome" id="p-installer" hidden>${t('profil.installer')}</button>
      <div class="actions" style="margin-top:4px">
        <button class="btn-sombre" id="p-export" style="flex:1">${t('profil.exporter')}</button>
        <button class="btn-sombre" id="p-import" style="flex:1">${t('profil.importer')}</button>
        <input type="file" id="p-input-import" accept=".json" hidden>
      </div>
      <button class="btn-discret btn-danger" id="p-vider" style="width:100%;margin-top:8px">${t('profil.toutEffacer')}</button>
      <p class="profil-version">Som' · v45</p>
    </div>`;

  // — Identité —
  $('#p-save-identite').onclick = () => {
    store.majSettings({ nom: $('#p-nom').value.trim(), email: $('#p-email').value.trim() });
    majAvatar(); rendreProfil(); toast(t('profil.toastProfil'));
  };
  // — Avatar photo —
  $('#p-avatar-btn').onclick = () => $('#p-avatar-input').click();
  $('#p-avatar-input').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const brut = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f);
      });
      const petit = await compresserDataUrl(brut, 256, 0.8);
      store.majSettings({ avatar: petit });
      majAvatar(); rendreProfil(); toast(t('profil.toastAvatar'));
    } catch (err) { toast('Erreur'); }
  };
  // — Abonnement (placeholder, sans backend) —
  $('#p-plan-toggle').onclick = () => {
    const premium = store.get().settings.plan === 'premium';
    store.majSettings({ plan: premium ? 'gratuit' : 'premium' });
    if (!premium) vibrer('succes');
    rendreProfil();
    toast(premium ? t('profil.toastGratuit') : t('profil.toastPremium'));
  };
  // — Préférences —
  $('#p-voix').onchange = (e) => store.majSettings({ voixActive: e.target.checked });
  $('#p-theme').onchange = (e) => {
    const theme = e.target.checked ? 'clair' : 'sombre';
    store.majSettings({ theme });
    // fondu croisé entre les deux mondes ; on neutralise la chorégraphie
    // directionnelle des écrans (data-sens) le temps de la bascule
    document.documentElement.removeAttribute('data-sens');
    if (document.startViewTransition) document.startViewTransition(() => appliquerTheme(theme));
    else appliquerTheme(theme);
    vibrer('tic');
  };
  $('#p-valeur').onchange = (e) => store.majSettings({ valeurCachee: e.target.checked });
  $('#p-lang').onchange = (e) => {
    store.majSettings({ lang: e.target.value });
    location.reload();
  };
  $('#p-save-api').onclick = () => {
    store.majSettings({ apiKey: $('#p-api').value.trim() });
    toast(t('profil.toastCle'));
  };
  // — Données —
  $('#p-export').onclick = () => {
    const blob = new Blob([store.exporter()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `som-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast(t('profil.toastExport'));
  };
  $('#p-import').onclick = () => $('#p-input-import').click();
  $('#p-input-import').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importer(await f.text()); majAvatar(); rendreProfil(); toast(t('profil.toastImport')); }
    catch (err) { toast(`Import impossible : ${err.message}`); }
  };
  $('#p-vider').onclick = () => {
    if (confirm(t('profil.confirmEffacer'))) {
      store.toutEffacer(); majAvatar(); rendreProfil(); toast(t('profil.toastEffacer'));
    }
  };
  // Bouton d'installation PWA
  if (window.__promptInstall) {
    const btn = $('#p-installer');
    btn.hidden = false;
    btn.onclick = () => window.__promptInstall();
  }
}

/* ═══ Init ═══ */
export function initUI() {
  document.querySelectorAll('.nav-item').forEach((b) => b.onclick = () => montrerEcran(b.dataset.ecran));
  $('#avatar-entete').onclick = () => montrerEcran('profil');
  $('#btn-retour-profil').onclick = () => montrerEcran(ecranAvantProfil);
  majAvatar();
  appliquerTheme(store.get().settings.theme);
  // Haptique « tic » sur tout ce qui se tape : onglets, segments, puces, avatar.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item, .seg, .puce, .avatar-entete')) vibrer('tic');
  });
  $('#voile').onclick = () => montrerFeuille(false);
  $('#feuille-fermer').onclick = () => montrerFeuille(false);
  brancherGlissementFeuille();
  brancherGlissementFicheHori();
  $('#recherche').oninput = rendreCave;
  $('#categorie-cave').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    catCave = s.dataset.cat;
    $('#categorie-cave').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
    rendreCave();
  });
  initAjouter();
  initSommelier();
  initAlertes();
  $('#vue-stats').querySelectorAll('.seg').forEach((s) => s.onclick = () => {
    vueStats = s.dataset.vue;
    $('#vue-stats').querySelectorAll('.seg').forEach((x) => x.classList.toggle('actif', x === s));
    rendreStats();
  });

  const { bottles } = store.get();
  montrerEcran(bottles.length ? 'cave' : 'ajouter');
  if (!bottles.length) toast(t('app.bienvenue'));
}
