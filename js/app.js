// Bootstrap : UI, service worker, invite d'installation PWA.
import { initUI } from './ui.js';

initUI();

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
