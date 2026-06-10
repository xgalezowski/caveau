// Voix : dictée (Web Speech API) + synthèse vocale française.
// Sur Chrome Android (Samsung), SpeechRecognition est dispo via le préfixe webkit.

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const voixDisponible = !!SR;

// Lance une dictée ; onResult(texte, final) appelé au fil de l'eau.
export function dicter({ onResult, onEnd, onError }) {
  if (!SR) { onError?.('Reconnaissance vocale non disponible sur ce navigateur'); return null; }
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let texte = '';
    let final = false;
    for (const res of e.results) { texte += res[0].transcript; if (res.isFinal) final = true; }
    onResult?.(texte.trim(), final);
  };
  rec.onerror = (e) => onError?.(e.error === 'not-allowed' ? 'Micro refusé — autorise-le dans les réglages du navigateur' : `Erreur micro : ${e.error}`);
  rec.onend = () => onEnd?.();
  rec.start();
  return rec;
}

let voixFr = null;
function trouverVoixFr() {
  if (voixFr) return voixFr;
  const voix = speechSynthesis.getVoices();
  voixFr = voix.find((v) => v.lang === 'fr-FR' && /enhanced|premium|google/i.test(v.name))
        || voix.find((v) => v.lang.startsWith('fr')) || null;
  return voixFr;
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => { voixFr = null; trouverVoixFr(); };
}

// Fait parler le sommelier (si la voix est activée dans les réglages).
// Repli : synthèse vocale du navigateur (robotique mais toujours dispo)
function parlerNavigateur(texte) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = 'fr-FR';
  u.rate = 1.02;
  u.pitch = 0.95;
  const v = trouverVoixFr();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

let audioCourant = null;
// synthGemini : fonction async (texte) → Blob audio, injectée par l'app.
// Si elle est fournie et réussit, on joue la belle voix ; sinon repli navigateur.
export async function parler(texte, actif = true, synthGemini = null) {
  if (!actif) return;
  tairetout();
  if (synthGemini) {
    try {
      const blob = await synthGemini(texte);
      if (blob) {
        const url = URL.createObjectURL(blob);
        audioCourant = new Audio(url);
        audioCourant.onended = () => URL.revokeObjectURL(url);
        await audioCourant.play();
        return;
      }
    } catch (e) {
      console.warn('Voix Gemini indisponible, repli navigateur', e);
    }
  }
  parlerNavigateur(texte);
}

export function tairetout() {
  if (audioCourant) { audioCourant.pause(); audioCourant = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
