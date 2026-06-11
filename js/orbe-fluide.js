// L'âme fluide du Sommelier : façade chorégraphique au-dessus de la vraie
// simulation Navier-Stokes GPU (fluide-sim.js, adaptée de PavelDoGreat, MIT).
//
// La matière est de l'encre de vin dans l'eau : au repos, quelques gouttes
// tombent et tourbillonnent lentement ; la voix injecte des éclats ; le
// silence laisse le fluide se calmer de lui-même ; la réflexion entretient
// un vortex. Le doigt peut jouer avec la matière (geste = remous natif).
//
// Sources d'énergie vocale :
//  - événements de transcription (impulsionVoix) — fiable partout ;
//  - amplitude réelle du micro (Web Audio) en complément, SAUF sur Android :
//    getUserMedia y confisquerait le micro de la reconnaissance vocale.

import { creerSimulation } from './fluide-sim.js';

const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ANDROID = /Android/i.test(navigator.userAgent);

/* Encres du caveau. Le rendu est ADDITIF et le bloom amplifie : l'original
   travaille à ≤ 0,15 par canal — au-delà, tout sature en blanc laiteux. */
const PALETTE = [
  { r: 0.105, g: 0.016, b: 0.032 }, // bordeaux profond
  { r: 0.15, g: 0.025, b: 0.046 },  // bordeaux vif
  { r: 0.16, g: 0.115, b: 0.026 },  // or patiné
  { r: 0.125, g: 0.035, b: 0.06 },  // lie-de-vin
];

export function creerOrbe(el) {
  let canvas = el.querySelector('canvas');
  let sim = null;
  let contextePerdu = false;

  function naitre() {
    sim = creerSimulation(canvas, {
      TRANSPARENT: true,
      PALETTE,
      DENSITY_DISSIPATION: 1.25,  // l'encre s'estompe doucement
      VELOCITY_DISSIPATION: 0.5,
      CURL: 38,                   // tourbillons vivants
      SPLAT_RADIUS: 0.26,
      SPLAT_FORCE: 5400,
      BLOOM: true,
      BLOOM_INTENSITY: 0.6,  // au-delà, les cœurs d'encre virent au blanc
      SUNRAYS: false,
      COLOR_UPDATE_SPEED: 6,
      PAUSED: reduitMouvement(),  // mouvement réduit : encre figée du départ
      // debug : les captures d'écran headless exigent un tampon préservé
      PRESERVE: localStorage.getItem('caveau:debug-fluide') === '1',
    });
    window.__sim = sim; // poignée de debug
    // Android peut sacrifier le contexte WebGL d'un onglet caché : on le
    // note, et le prochain réveil fera renaître la simulation sur un canvas neuf
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      contextePerdu = true;
    }, { once: true });
  }
  naitre();

  let etatCourant = 'repos';
  let audioCtx = null, flux = null, analyseur = null, donneesAudio = null;
  let volLisse = 0, volPrec = 0;
  let boostVoix = 0;
  let angleVortex = 0;
  let horloge = 0;

  const alea = (a, b) => a + Math.random() * (b - a);

  /* un éclat : position [0..1], vitesse en unités sim (~±600 = vif) */
  function eclat(x, y, dx, dy, intensite = 1) {
    const c = sim.generateColor();
    c.r *= intensite; c.g *= intensite; c.b *= intensite;
    sim.splat(x, y, dx, dy, c);
  }

  function goutteDouce() {
    eclat(alea(0.35, 0.65), alea(0.4, 0.68), alea(-120, 120), alea(-160, 60), 1.35);
  }

  function rafaleVoix(force) {
    const n = 3 + Math.round(force * 3);
    for (let i = 0; i < n; i++) {
      const a = alea(0, Math.PI * 2);
      const v = 400 + force * 950;
      eclat(
        0.5 + Math.cos(a) * 0.07, 0.52 + Math.sin(a) * 0.07,
        Math.cos(a) * v, Math.sin(a) * v,
        1.5 + force * 1.1
      );
    }
  }

  /* chorégraphie : un battement toutes les 150 ms */
  const battement = setInterval(() => {
    sim.config.DORMIR = document.hidden || !el.offsetParent || reduitMouvement();
    if (sim.config.DORMIR) return;
    horloge++;
    boostVoix *= 0.86;

    if (etatCourant === 'repos' && horloge % 8 === 0) goutteDouce();

    if (etatCourant === 'ecoute') {
      const voix = Math.max(volLisse, boostVoix);
      // attaque mesurée au micro (desktop) : rafale immédiate
      if (analyseur && volLisse - volPrec > 0.09) rafaleVoix(volLisse);
      else if (voix > 0.07) rafaleVoix(voix * 0.55);
      else if (horloge % 20 === 0) goutteDouce(); // le silence respire à peine
      volPrec = volLisse;
    }

    if (etatCourant === 'reflexion') {
      // vortex entretenu : éclats tangentiels sur un cercle
      angleVortex += 0.85;
      const r = 0.20;
      const x = 0.5 + Math.cos(angleVortex) * r;
      const y = 0.52 + Math.sin(angleVortex) * r;
      eclat(x, y, -Math.sin(angleVortex) * 480, Math.cos(angleVortex) * 480, 0.85);
    }

    if (etatCourant === 'parle' && horloge % 3 === 0) {
      // la matière articule : pulsations alternées au centre
      const haut = (horloge / 3) % 2 === 0;
      eclat(0.5, 0.52, alea(-140, 140), haut ? 320 : -320, 0.9);
    }
  }, 150);

  function majVolume() {
    if (!analyseur) return;
    analyseur.getByteTimeDomainData(donneesAudio);
    let somme = 0;
    for (let i = 0; i < donneesAudio.length; i++) {
      const c = (donneesAudio[i] - 128) / 128;
      somme += c * c;
    }
    const vol = Math.min(1, Math.sqrt(somme / donneesAudio.length) * 4.5);
    volLisse += (vol - volLisse) * 0.35;
  }
  const horlogeVolume = setInterval(majVolume, 50);

  function couperMicro() {
    if (flux) { flux.getTracks().forEach((p) => p.stop()); flux = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
    analyseur = null; volLisse = 0;
  }

  return {
    get etat() { return etatCourant; },

    etatVers(nom) {
      etatCourant = nom;
      el.dataset.etat = nom;
      boostVoix = 0;
      if (nom !== 'ecoute') couperMicro();
      if (nom === 'reflexion') angleVortex = 0;
    },

    /* Éclaboussure de bienvenue, en trois vagues : la première peut se
       perdre dans le redimensionnement ou la transition d'écran, les
       suivantes garantissent qu'il y a toujours de l'encre à l'arrivée. */
    reveiller() {
      if (contextePerdu) {
        // contexte WebGL sacrifié par le navigateur : canvas neuf, sim neuve
        sim.config.DORMIR = true; // l'ancienne boucle s'endort pour de bon
        const neuf = canvas.cloneNode(false);
        canvas.replaceWith(neuf);
        canvas = neuf;
        contextePerdu = false;
        naitre();
      }
      // éclats maison plutôt que multipleSplats (qui multiplie ×10 → cœurs
      // blancs) : mêmes encres que le reste, cœurs colorés
      const vague = (n) => {
        sim.config.DORMIR = false;
        for (let i = 0; i < n; i++) {
          eclat(alea(0.2, 0.8), alea(0.25, 0.75), alea(-520, 520), alea(-520, 520), 1.8);
        }
      };
      vague(4);
      setTimeout(() => vague(3), 380);
      setTimeout(() => { sim.config.DORMIR = false; goutteDouce(); goutteDouce(); }, 850);
    },

    /* La reconnaissance vient de transcrire : la matière encaisse l'éclat. */
    impulsionVoix(force = 0.5) {
      boostVoix = Math.min(1, boostVoix + 0.45 + force * 0.55);
      if (!sim.config.DORMIR) rafaleVoix(0.6 + force * 0.4);
    },

    async ecouter() {
      this.etatVers('ecoute');
      if (reduitMouvement()) return;
      // Android : getUserMedia confisquerait le micro de la reconnaissance
      if (ANDROID) return;
      try {
        flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(flux);
        analyseur = audioCtx.createAnalyser();
        analyseur.fftSize = 512;
        donneesAudio = new Uint8Array(analyseur.fftSize);
        source.connect(analyseur);
      } catch { /* pas de micro : les impulsions de transcription suffisent */ }
    },

    detruire() { clearInterval(battement); clearInterval(horlogeVolume); couperMicro(); },
  };
}
