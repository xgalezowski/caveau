// Orbe vocale du Sommelier : un visuel qui respire au repos et réagit à
// l'amplitude de la voix pendant l'écoute. La réactivité passe par une seule
// variable CSS (--vol, 0..1) posée sur l'élément — tout le rendu est en CSS.
//
// Deux sources d'animation, par ordre de préférence :
//  1. Web Audio API : getUserMedia + AnalyserNode → amplitude réelle du micro.
//  2. Repli synthétique : pulsation pseudo-aléatoire lissée, si le micro est
//     refusé ou indisponible (la reconnaissance vocale, elle, garde son propre
//     accès — les deux ne partagent pas le même flux).

const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function creerOrbe(el) {
  let etatCourant = 'repos';
  let rafId = 0;
  let audioCtx = null;
  let flux = null;
  let analyseur = null;
  let donnees = null;
  let volLisse = 0;

  function poserVol(v) {
    volLisse += (v - volLisse) * 0.25; // lissage : pas de tremblements
    el.style.setProperty('--vol', volLisse.toFixed(3));
  }

  // Amplitude réelle : RMS du signal temporel, amplifiée pour la voix parlée.
  function boucleMicro() {
    analyseur.getByteTimeDomainData(donnees);
    let somme = 0;
    for (let i = 0; i < donnees.length; i++) {
      const c = (donnees[i] - 128) / 128;
      somme += c * c;
    }
    const rms = Math.sqrt(somme / donnees.length);
    poserVol(Math.min(1, rms * 4.5));
    rafId = requestAnimationFrame(boucleMicro);
  }

  // Repli : une « voix » synthétique faite de deux sinus déphasés + bruit.
  function boucleSynthetique() {
    const t = performance.now() / 1000;
    const v = 0.25 + 0.18 * Math.sin(t * 3.1) + 0.12 * Math.sin(t * 7.7) + Math.random() * 0.08;
    poserVol(Math.max(0, Math.min(1, v)));
    rafId = requestAnimationFrame(boucleSynthetique);
  }

  function arreterBoucle() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    poserVol(0);
    el.style.setProperty('--vol', '0');
    volLisse = 0;
  }

  function couperMicro() {
    if (flux) { flux.getTracks().forEach((t) => t.stop()); flux = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
    analyseur = null;
  }

  return {
    /** repos | ecoute | reflexion | parle */
    get etat() { return etatCourant; },

    etatVers(nom) {
      etatCourant = nom;
      el.dataset.etat = nom;
      if (nom !== 'ecoute') { arreterBoucle(); couperMicro(); }
      // L'état « parle » pulse en synthétique (pas d'accès au flux TTS)
      if (nom === 'parle' && !reduitMouvement()) { rafId = requestAnimationFrame(boucleSynthetique); }
    },

    // À appeler quand la dictée démarre : tente l'amplitude réelle,
    // se rabat sur la pulsation synthétique sans bruit d'erreur.
    async ecouter() {
      this.etatVers('ecoute');
      if (reduitMouvement()) return;
      try {
        flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(flux);
        analyseur = audioCtx.createAnalyser();
        analyseur.fftSize = 512;
        donnees = new Uint8Array(analyseur.fftSize);
        source.connect(analyseur);
        rafId = requestAnimationFrame(boucleMicro);
      } catch {
        rafId = requestAnimationFrame(boucleSynthetique);
      }
    },

    detruire() { arreterBoucle(); couperMicro(); },
  };
}
