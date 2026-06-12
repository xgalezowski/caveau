// Bootstrap : UI, service worker, invite d'installation PWA.
import { initUI, toast } from './ui.js';
import { store } from './store.js';

// Lien magique : ouvrir l'app avec #cle=XXX enregistre la clé IA dans les
// réglages (une seule fois), puis nettoie l'URL. Le fragment ne quitte
// jamais le navigateur — rien ne transite par le serveur ni par le code.
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('cle')) {
  store.majSettings({ apiKey: hash.get('cle') });
  history.replaceState(null, '', location.pathname + location.search);
}

initUI();
if (store.get().settings.apiKey && hash.get('cle')) toast('🔑 Clé IA enregistrée sur cet appareil');

// PWA : installation
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.__promptInstall = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    window.__promptInstall = null;
  };
});

// PWA : cache offline + mise à jour automatique.
// Quand un nouveau SW prend la main (skipWaiting + claim), la page se
// recharge une fois toute seule : plus besoin du « double rechargement ».
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // updateViaCache 'none' : le script du SW est TOUJOURS revérifié au réseau
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      const verifier = () => reg.update().catch(() => {});
      // PWA installée : le processus peut vivre des jours — on revérifie
      // au retour au premier plan ET toutes les minutes tant qu'on est ouvert
      // (sinon une app laissée au premier plan ne se met jamais à jour).
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) verifier();
      });
      setInterval(() => { if (!document.hidden) verifier(); }, 60000);
    })
    .catch((e) => console.warn('SW non enregistré', e));

  const avaitControleur = !!navigator.serviceWorker.controller;
  let dejaRecharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Première installation : claim() déclenche aussi cet événement,
    // mais il n'y a rien de neuf à recharger.
    if (!avaitControleur || dejaRecharge) return;
    dejaRecharge = true;
    location.reload();
  });
}
