// Orbe fluide du Sommelier : simulation de métaballes à physique de ressorts.
// Une dizaine de gouttes sont liées au centre par une cohésion variable ;
// la voix (amplitude réelle du micro) relâche cette cohésion, injecte du
// bruit et des impulsions — la matière s'étend, danse, puis se refige et se
// regroupe au silence. Rendu canvas + effet « goo » (blur/contrast CSS) :
// les gouttes fusionnent visuellement comme un liquide.
//
// API identique à l'ancienne orbe : { etat, etatVers(nom), ecouter(), detruire() }.

const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const N_GOUTTES = 11;

/* Principe : chaque goutte poursuit une CIBLE ORBITALE propre. La distance
   de ces cibles au centre est pilotée par l'« énergie » (la voix) : énergie
   nulle → toutes les cibles au centre → la matière fusionne en orbe ;
   énergie forte → cibles dispersées → la matière s'étire et se déchire.
   L'énergie attaque vite et retombe lentement : la matière reste déployée
   un instant après un éclat de voix, puis se regroupe. */

export function creerOrbe(el) {
  const canvas = el.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const TAILLE = 200; // px CSS
  canvas.width = TAILLE;
  canvas.height = TAILLE;
  const C = TAILLE / 2;            // centre
  const RAYON_VIE = TAILLE * 0.37; // zone de vie : marge pour le champ des gouttes au bord

  // L'iso-surface est calculée pixel par pixel dans un petit tampon,
  // puis agrandie avec lissage : bords liquides, canvas transparent
  // (aucun fond opaque, aucun filtre CSS — se fond sur n'importe quel décor).
  const RES = 128;
  const tampon = document.createElement('canvas');
  tampon.width = RES; tampon.height = RES;
  const ctxT = tampon.getContext('2d');
  const img = ctxT.createImageData(RES, RES);
  const ECH = RES / TAILLE; // échelle monde → tampon
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let etatCourant = 'repos';
  let rafId = 0;
  let audioCtx = null, flux = null, analyseur = null, donneesAudio = null;
  let vol = 0, volLisse = 0, volPrec = 0;
  let silenceDepuis = 0; // ms de silence consécutif pendant l'écoute
  let t = 0;

  let energie = 0;       // 0 = orbe regroupée · 1 = matière éclatée
  let figee = false;     // silence prolongé pendant l'écoute

  /* ── les gouttes ── */
  const gouttes = Array.from({ length: N_GOUTTES }, (_, i) => {
    const a = (i / N_GOUTTES) * Math.PI * 2;
    return {
      x: C + Math.cos(a) * 12,
      y: C + Math.sin(a) * 12,
      vx: 0, vy: 0,
      r: 10 + (i % 5) * 4.5,                  // rayons variés : matière irrégulière
      angle: a,                               // direction orbitale propre
      derive: 0.10 + (i % 7) * 0.05,          // vitesse de tournoiement propre
      phase: (i * 2.39996) % (Math.PI * 2),   // angle d'or : déphasages bien répartis
      freq: 0.6 + ((i * 13) % 10) / 11,
    };
  });

  function physique() {
    t += 1 / 60;

    // ── énergie : la grandeur qui commande toute la chorégraphie ──
    let cible = 0.10; // repos : léger frémissement
    if (etatCourant === 'ecoute') {
      cible = 0.12 + volLisse * 1.25;
      if (volLisse < 0.05) {
        silenceDepuis += 16;
        figee = silenceDepuis > 550; // silence : la matière se fige…
      } else { silenceDepuis = 0; figee = false; }
      if (figee) cible = 0.02;       // …et rentre se regrouper
    } else figee = false;
    if (etatCourant === 'reflexion') cible = 0.42; // anneau qui tournoie
    if (etatCourant === 'parle') {
      cible = 0.18 + 0.4 * Math.abs(Math.sin(t * 6.8) * Math.sin(t * 2.1));
    }
    cible = Math.min(1, cible);
    // attaque rapide, retombée lente : la matière « respire » après la voix
    energie += (cible - energie) * (cible > energie ? 0.30 : 0.045);

    // attaque de voix (plosive) : impulsion radiale immédiate
    if (etatCourant === 'ecoute' && volLisse - volPrec > 0.09) {
      for (const g of gouttes) {
        const dx = g.x - C, dy = g.y - C, d = Math.hypot(dx, dy) || 1;
        const f = 2.2 + Math.random() * 2.4;
        g.vx += (dx / d) * f; g.vy += (dy / d) * f;
      }
    }
    volPrec = volLisse;

    const vortex = etatCourant === 'reflexion' ? 6 : 1;
    const amort = figee ? 0.88 : 0.94;
    const k = figee ? 0.05 : 0.026;

    for (const g of gouttes) {
      // la cible orbitale s'éloigne du centre avec l'énergie,
      // et ondule pour que la matière vive même à énergie constante
      g.angle += g.derive * 0.013 * vortex * (1 + energie * 2.2);
      const houle = 1 + 0.35 * Math.sin(t * g.freq * 2.2 + g.phase);
      const portee = RAYON_VIE * (0.06 + 0.82 * energie) * houle;
      const cx = C + Math.cos(g.angle) * portee;
      const cy = C + Math.sin(g.angle) * portee;
      g.vx += (cx - g.x) * k;
      g.vy += (cy - g.y) * k;
      // répulsion courte : la matière garde son grain et peut se déchirer
      for (const h of gouttes) {
        if (h === g) continue;
        const ex = g.x - h.x, ey = g.y - h.y;
        const d2 = ex * ex + ey * ey;
        if (d2 < 420 && d2 > 0.01) { const f = 0.9 / d2; g.vx += ex * f; g.vy += ey * f; }
      }
      g.vx *= amort; g.vy *= amort;
      g.x += g.vx; g.y += g.vy;
      // la matière reste dans sa zone de vie (rebond mou)
      const ddx = g.x - C, ddy = g.y - C, dd = Math.hypot(ddx, ddy);
      if (dd > RAYON_VIE) {
        g.x = C + (ddx / dd) * RAYON_VIE; g.y = C + (ddy / dd) * RAYON_VIE;
        g.vx *= -0.35; g.vy *= -0.35;
      }
    }
  }

  /* Iso-surface de métaballes : champ f(p) = Σ r²/d², seuillé en deux zones —
     liseré d'or liquide sur le bord, chair bordeaux profonde au cœur,
     pointe dorée là où la matière est dense. */
  function dessiner() {
    const souffle = 1 + volLisse * 0.40; // la matière gonfle avec la voix
    const d8 = img.data;
    // pré-calculs par goutte (coordonnées tampon)
    const gs = gouttes.map((g) => ({
      x: g.x * ECH, y: g.y * ECH,
      r2: (g.r * souffle * ECH) * (g.r * souffle * ECH),
    }));
    let i = 0;
    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++, i += 4) {
        let f = 0;
        for (const g of gs) {
          const dx = px - g.x, dy = py - g.y;
          f += g.r2 / (dx * dx + dy * dy + 1);
        }
        if (f < 0.72) { d8[i + 3] = 0; continue; } // hors de la matière
        if (f < 1.08) {
          // liseré : or liquide, fondu progressif vers l'extérieur
          const a = (f - 0.72) / 0.36;
          d8[i] = 222; d8[i + 1] = 190; d8[i + 2] = 104;
          d8[i + 3] = a * a * 230; // quadratique : bord très doux
          continue;
        }
        // chair : bordeaux vif en surface → bordeaux profond au cœur
        const k = Math.min(1, (f - 1.08) / 2.4);
        d8[i]     = 158 - 44 * k;
        d8[i + 1] = 60 - 13 * k;
        d8[i + 2] = 74 - 19 * k;
        d8[i + 3] = 244;
      }
    }
    ctxT.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, TAILLE, TAILLE);
    ctx.drawImage(tampon, 0, 0, TAILLE, TAILLE);
  }

  let cadence = 0;
  function boucle() {
    rafId = requestAnimationFrame(boucle);
    // écran caché ou onglet inactif : on ne calcule pas pour rien
    if (document.hidden || !el.offsetParent) return;
    // au repos, 30 i/s suffisent (batterie) ; sinon pleine cadence
    cadence++;
    if (etatCourant === 'repos' && cadence % 2) return;
    majVolume();
    physique();
    dessiner();
  }

  /* ── voix : amplitude réelle du micro, repli synthétique ── */
  function majVolume() {
    if (analyseur) {
      analyseur.getByteTimeDomainData(donneesAudio);
      let somme = 0;
      for (let i = 0; i < donneesAudio.length; i++) {
        const c = (donneesAudio[i] - 128) / 128;
        somme += c * c;
      }
      vol = Math.min(1, Math.sqrt(somme / donneesAudio.length) * 4.5);
    } else if (etatCourant === 'ecoute') {
      vol = Math.max(0, Math.min(1, 0.3 + 0.2 * Math.sin(t * 3.1) + Math.random() * 0.12));
    } else vol = 0;
    volLisse += (vol - volLisse) * 0.3;
  }

  function couperMicro() {
    if (flux) { flux.getTracks().forEach((p) => p.stop()); flux = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
    analyseur = null;
  }

  // Mouvement réduit : une seule image, sage et regroupée.
  if (reduitMouvement()) { physique(); dessiner(); }
  else boucle();

  return {
    get etat() { return etatCourant; },

    etatVers(nom) {
      etatCourant = nom;
      el.dataset.etat = nom;
      silenceDepuis = 0;
      if (nom !== 'ecoute') couperMicro();
    },

    async ecouter() {
      this.etatVers('ecoute');
      if (reduitMouvement()) return;
      try {
        flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(flux);
        analyseur = audioCtx.createAnalyser();
        analyseur.fftSize = 512;
        donneesAudio = new Uint8Array(analyseur.fftSize);
        source.connect(analyseur);
      } catch { /* pas de micro : la pulsation synthétique prend le relais */ }
    },

    detruire() { cancelAnimationFrame(rafId); couperMicro(); },
  };
}
