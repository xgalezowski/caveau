// Bootstrap : UI, service worker, invite d'installation PWA.
import { initUI, toast } from './ui.js';
import { store } from './store.js';
import { traduireDOM } from './i18n.js';

// Lien magique : ouvrir l'app avec #cle=XXX enregistre la clé IA dans les
// réglages (une seule fois), puis nettoie l'URL. Le fragment ne quitte
// jamais le navigateur — rien ne transite par le serveur ni par le code.
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('cle')) {
  store.majSettings({ apiKey: hash.get('cle') });
  history.replaceState(null, '', location.pathname + location.search);
}

traduireDOM();
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
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // updateViaCache 'none' : le script du SW est TOUJOURS revérifié au réseau
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      const verifier = () => reg.update().catch(() => {});
      // PWA installée : le processus peut vivre des jours — on revérifie
      // au retour au premier plan ET toutes les minutes tant qu'on est ouvert.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) verifier();
      });
      setInterval(() => { if (!document.hidden) verifier(); }, 60000);

      // Un nouveau SW en attente (waiting) = mise à jour prête à installer.
      // On lui dit de prendre les commandes tout de suite via un message.
      function activerSWEnAttente(sw) {
        sw.postMessage({ type: 'SKIP_WAITING' });
      }
      // SW déjà en attente dès l'enregistrement (déploiement récent)
      if (reg.waiting) activerSWEnAttente(reg.waiting);
      // SW qui passe en waiting pendant la session
      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing;
        if (!nouveau) return;
        nouveau.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
            activerSWEnAttente(nouveau);
          }
        });
      });
    })
    .catch((e) => console.warn('SW non enregistré', e));

  // Quand un nouveau SW prend le contrôle, on recharge la page.
  // On utilise un toast cliquable plutôt qu'un reload silencieux : sur Android
  // PWA, location.reload() peut être ignoré si la page est en arrière-plan.
  const avaitControleur = !!navigator.serviceWorker.controller;
  let dejaRecharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!avaitControleur || dejaRecharge) return;
    dejaRecharge = true;
    // Tentative de rechargement automatique ; si la page est au premier plan
    // ça marche directement. Sinon l'utilisateur verra le toast au retour.
    if (!document.hidden) {
      location.reload();
    } else {
      document.addEventListener('visibilitychange', function rechargerAuRetour() {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', rechargerAuRetour);
        location.reload();
      });
    }
  });
}
