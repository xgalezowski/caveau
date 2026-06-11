// Effets « natifs » : haptique + transitions d'écran (View Transitions API).
// Tout est dégradable : sans support navigateur, l'app fonctionne à l'identique.

const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── Haptique ───
   Motifs courts et distincts : « tic » pour la navigation, « succes » pour
   une validation, « sortie » pour la sortie de cave (petit roulement),
   « erreur » double coup lourd. Android uniquement (iOS n'expose pas vibrate). */
const MOTIFS = {
  tic: 8,
  succes: [12, 60, 24],
  sortie: [10, 45, 10, 45, 35],
  erreur: [45, 70, 45],
};

export function vibrer(type = 'tic') {
  if (!navigator.vibrate) return;
  try { navigator.vibrate(MOTIFS[type] ?? MOTIFS.tic); } catch { /* silencieux */ }
}

/* ─── Transitions d'écran ───
   `sens` pilote la chorégraphie CSS via html[data-sens] :
   - avant / arriere : glissé latéral léger entre onglets
   - profil / profil-retour : montée en fondu (modale) pour le profil. */
export function transitionEcran(sens, appliquer) {
  if (!document.startViewTransition || reduitMouvement()) { appliquer(); return; }
  document.documentElement.dataset.sens = sens;
  document.startViewTransition(appliquer);
}
