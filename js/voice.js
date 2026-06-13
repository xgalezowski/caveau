// Voix : dictée (Web Speech API) + synthèse vocale française.
// Sur Chrome Android (Samsung), SpeechRecognition est dispo via le préfixe webkit.

import { store } from './store.js';
import { t } from './i18n.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const voixDisponible = !!SR;

// iOS/iPadOS ne donne PAS l'API de reconnaissance vocale aux apps web. Repli
// universel : quand la dictée « maison » est indispo, on donne le focus au champ
// et l'utilisateur dicte avec le micro du clavier (dictée native, sur l'appareil
// — rien ne quitte le téléphone). repliClavier vaut donc true exactement quand
// voixDisponible vaut false.
export const repliClavier = !SR;
export const estIOS = typeof navigator !== 'undefined' &&
  (/iP(hone|od|ad)/.test(navigator.platform) ||
    (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1));

let astuceClavierVue = false;
// Donne le focus au champ pour invoquer la dictée native du clavier ; sur iOS,
// affiche une fois une astuce signalant le micro du clavier.
export function inviterDicteeClavier(champ, toast) {
  if (!champ) return;
  champ.focus();
  try { const n = champ.value.length; champ.setSelectionRange(n, n); } catch { /* range non supporté */ }
  if (estIOS && !astuceClavierVue && typeof toast === 'function') {
    astuceClavierVue = true;
    toast(t('voix.astuceClavier'));
  }
}

// Lance une dictée ; onResult(texte, final) appelé au fil de l'eau.
// Mode `continu` : on n'arrête PAS à la première pause — la fin de phrase
// est détectée par un silence prolongé (silenceMs) après le dernier mot,
// pour laisser à l'utilisateur le temps de finir sa pensée.
export function dicter({ onResult, onEnd, onError, continu = false, silenceMs = 1800, dureeMax = 20000 }) {
  if (!SR) { onError?.('Reconnaissance vocale non disponible sur ce navigateur'); return null; }
  const lang = store.get().settings.lang || 'fr';
  const rec = new SR();
  rec.lang = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-PY' : 'fr-FR';
  rec.interimResults = true;
  rec.continuous = continu;

  let minuteurSilence = null;
  let minuteurMax = null;
  const arreter = () => { try { rec.stop(); } catch { } };
  if (continu) minuteurMax = setTimeout(arreter, dureeMax); // garde-fou

  // Chrome Android RELIVRE les segments déjà reçus (bug connu du mode
  // continu) : on accumule les segments FINAUX par leur index — chacun ne
  // compte qu'une fois — et on n'ajoute que l'hypothèse en cours à la fin.
  const finaux = [];
  rec.onresult = (e) => {
    let enCours = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finaux[i] = res[0].transcript;
      else enCours += res[0].transcript;
    }
    const texte = `${finaux.filter(Boolean).join(' ')} ${enCours}`.replace(/\s+/g, ' ').trim();
    onResult?.(texte, false);
    if (continu) {
      // chaque nouveau mot repousse la fin : on ne conclut qu'au vrai silence
      clearTimeout(minuteurSilence);
      minuteurSilence = setTimeout(arreter, silenceMs);
    }
  };
  rec.onerror = (e) => onError?.(e.error === 'not-allowed' ? t('voix.erreurMicroRefuse') : `${t('voix.erreurMicro')} : ${e.error}`);
  rec.onend = () => { clearTimeout(minuteurSilence); clearTimeout(minuteurMax); onEnd?.(); };
  rec.start();
  return rec;
}

let voixPreferee = null;
let languePreferee = null;
function trouverVoixLocale() {
  const lang = store.get().settings.lang || 'fr';
  const code = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-PY' : 'fr-FR';
  if (voixPreferee && languePreferee === code) return voixPreferee;
  const voix = speechSynthesis.getVoices();
  const prefPattern = lang === 'es' ? /natural|premium|google/i : /enhanced|premium|google/i;
  voixPreferee = voix.find((v) => v.lang === code && prefPattern.test(v.name))
        || voix.find((v) => v.lang.startsWith(lang)) || null;
  languePreferee = code;
  return voixPreferee;
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => { voixPreferee = null; trouverVoixLocale(); };
}

// Fait parler le sommelier (si la voix est activée dans les réglages).
// Repli : synthèse vocale du navigateur (robotique mais toujours dispo).
// La promesse se résout à la FIN de la lecture — l'app peut animer pendant.
function parlerNavigateur(texte) {
  return new Promise((fin) => {
    if (typeof speechSynthesis === 'undefined') return fin();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    const lang = store.get().settings.lang || 'fr';
    u.lang = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-PY' : 'fr-FR';
    u.rate = 1.02;
    u.pitch = 0.95;
    const v = trouverVoixLocale();
    if (v) u.voice = v;
    u.onend = fin;
    u.onerror = fin;
    speechSynthesis.speak(u);
  });
}

let audioCourant = null;
// synthGemini : fonction async (texte) → Blob audio, injectée par l'app.
// Si elle est fournie et réussit, on joue la belle voix ; sinon repli navigateur.
export async function parler(texte, actif = true, synthGemini = null) {
  if (!actif) return;
  tairetout();
  if (synthGemini) {
    try {
      const blob = await Promise.race([
        synthGemini(texte),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 800))
      ]);
      if (blob) {
        const url = URL.createObjectURL(blob);
        audioCourant = new Audio(url);
        await new Promise((fin) => {
          audioCourant.onended = () => { URL.revokeObjectURL(url); fin(); };
          audioCourant.onerror = () => fin();
          audioCourant.play().catch(() => fin());
        });
        return;
      }
    } catch (e) {
      if (e.message !== 'timeout') {
        console.warn('Voix Gemini indisponible, repli navigateur', e);
      }
    }
  }
  await parlerNavigateur(texte);
}

export function tairetout() {
  if (audioCourant) { audioCourant.pause(); audioCourant = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
