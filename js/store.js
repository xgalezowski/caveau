// État applicatif + persistance localStorage + export/import.
const KEY = 'caveau:v1';

const defaults = () => ({
  version: 1,
  bottles: [],
  watches: [],          // { id, type: 'region'|'millesime'|'reference', valeur, seuil }
  settings: { apiKey: '', voixActive: true, prenom: '', valeurCachee: false,
    nom: '', email: '', avatar: '', plan: 'gratuit', theme: 'sombre', lang: 'fr' },
});

let state = charger();
const listeners = new Set();

function charger() {
  try {
    const brut = localStorage.getItem(KEY);
    if (!brut) return defaults();
    const data = JSON.parse(brut);
    return { ...defaults(), ...data, settings: { ...defaults().settings, ...(data.settings || {}) } };
  } catch (e) {
    console.warn('Caveau : données illisibles, sauvegarde de secours créée', e);
    try { localStorage.setItem(KEY + ':secours', localStorage.getItem(KEY) || ''); } catch {}
    return defaults();
  }
}

function sauver() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Caveau : sauvegarde impossible', e); }
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  ajouterBouteille(b) {
    const bottle = { id: uid(), ajoutLe: new Date().toISOString().slice(0, 10), sorties: [], ...b };
    state.bottles.push(bottle);
    sauver();
    return bottle;
  },
  majBouteille(id, patch) {
    const b = state.bottles.find((x) => x.id === id);
    if (b) { Object.assign(b, patch); sauver(); }
    return b;
  },
  supprimerBouteille(id) {
    state.bottles = state.bottles.filter((x) => x.id !== id);
    sauver();
  },
  // Sortir une bouteille de la cave (décrémente, journalise)
  sortirBouteille(id, occasion = '', note = '') {
    const b = state.bottles.find((x) => x.id === id);
    if (!b || b.qty <= 0) return null;
    b.qty -= 1;
    b.sorties = b.sorties || [];
    b.sorties.push({ date: new Date().toISOString().slice(0, 10), occasion, note });
    sauver();
    return b;
  },

  ajouterVeille(w) { state.watches.push({ id: uid(), ...w }); sauver(); },
  supprimerVeille(id) { state.watches = state.watches.filter((x) => x.id !== id); sauver(); },

  majSettings(patch) { Object.assign(state.settings, patch); sauver(); },

  exporter() { return JSON.stringify(state, null, 2); },
  importer(json) {
    const data = JSON.parse(json); // laisse remonter l'erreur à l'appelant
    if (!Array.isArray(data.bottles)) throw new Error('Format inattendu : pas de liste de bouteilles');
    state = { ...defaults(), ...data };
    sauver();
  },
  toutEffacer() { state = defaults(); sauver(); },
};

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
