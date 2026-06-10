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

// PWA : cache offline
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW non enregistré', e));
}
