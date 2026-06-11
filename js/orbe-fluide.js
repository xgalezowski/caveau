// Orbe fluide du Sommelier : simulation de métaballes à physique orbitale.
//
// Chaque goutte poursuit une cible orbitale propre ; la distance des cibles
// au centre est pilotée par l'« énergie » (la voix) : énergie nulle → la
// matière fusionne en orbe ; énergie forte → elle s'étire et se déchire.
// L'énergie attaque vite et retombe lentement — la matière reste déployée
// un instant après un éclat de voix, puis se regroupe. Silence prolongé
// pendant l'écoute : elle se fige.
//
// Rendu : WebGL plein-résolution (bords smoothstep — lisse à toute densité
// d'écran), repli canvas 2D si WebGL est indisponible.
//
// Sources d'énergie vocale :
//  - événements de la reconnaissance (impulsionVoix) — fiable partout ;
//  - amplitude réelle du micro (Web Audio) en complément, SAUF sur Android :
//    y ouvrir getUserMedia pendant une reconnaissance vocale la prive du
//    micro — plus aucune transcription. Android = événements seulement.

const reduitMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ANDROID = /Android/i.test(navigator.userAgent);

const N = 11;
const TAILLE = 200; // px CSS

export function creerOrbe(el) {
  const canvas = el.querySelector('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = TAILLE * dpr;
  canvas.height = TAILLE * dpr;
  const C = TAILLE / 2;
  const RAYON_VIE = TAILLE * 0.37;

  let etatCourant = 'repos';
  let rafId = 0;
  let audioCtx = null, flux = null, analyseur = null, donneesAudio = null;
  let vol = 0, volLisse = 0, volPrec = 0;
  let boostVoix = 0;     // énergie issue des événements de reconnaissance
  let energie = 0;       // 0 = orbe regroupée · 1 = matière éclatée
  let silenceDepuis = 0;
  let figee = false;
  let t = 0;

  /* ── les gouttes ── */
  const gouttes = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    return {
      x: C + Math.cos(a) * 12,
      y: C + Math.sin(a) * 12,
      vx: 0, vy: 0,
      r: 10 + (i % 5) * 4.5,
      angle: a,
      derive: 0.10 + (i % 7) * 0.05,
      phase: (i * 2.39996) % (Math.PI * 2), // angle d'or : déphasages répartis
      freq: 0.6 + ((i * 13) % 10) / 11,
    };
  });

  function physique() {
    t += 1 / 60;
    boostVoix *= 0.93; // les impulsions de voix s'éteignent doucement

    // ── énergie : la grandeur qui commande toute la chorégraphie ──
    let cible = 0.10;
    if (etatCourant === 'ecoute') {
      const voix = Math.max(volLisse * 1.25, boostVoix * 0.95);
      cible = 0.12 + voix;
      const silencieux = analyseur ? volLisse < 0.05 : boostVoix < 0.05;
      if (silencieux) {
        silenceDepuis += 16;
        figee = silenceDepuis > 550; // silence : la matière se fige…
      } else { silenceDepuis = 0; figee = false; }
      if (figee) cible = 0.02;       // …et rentre se regrouper
    } else figee = false;
    if (etatCourant === 'reflexion') cible = 0.42;
    if (etatCourant === 'parle') {
      cible = 0.18 + 0.4 * Math.abs(Math.sin(t * 6.8) * Math.sin(t * 2.1));
    }
    cible = Math.min(1, cible);
    energie += (cible - energie) * (cible > energie ? 0.30 : 0.045);

    // attaque de voix mesurée au micro : impulsion radiale immédiate
    if (etatCourant === 'ecoute' && analyseur && volLisse - volPrec > 0.09) impulsionRadiale(2.2);
    volPrec = volLisse;

    const vortex = etatCourant === 'reflexion' ? 6 : 1;
    const amort = figee ? 0.88 : 0.94;
    const k = figee ? 0.05 : 0.026;

    for (const g of gouttes) {
      g.angle += g.derive * 0.013 * vortex * (1 + energie * 2.2);
      const houle = 1 + 0.35 * Math.sin(t * g.freq * 2.2 + g.phase);
      const portee = RAYON_VIE * (0.06 + 0.82 * energie) * houle;
      const cx = C + Math.cos(g.angle) * portee;
      const cy = C + Math.sin(g.angle) * portee;
      g.vx += (cx - g.x) * k;
      g.vy += (cy - g.y) * k;
      for (const h of gouttes) {
        if (h === g) continue;
        const ex = g.x - h.x, ey = g.y - h.y;
        const d2 = ex * ex + ey * ey;
        if (d2 < 420 && d2 > 0.01) { const f = 0.9 / d2; g.vx += ex * f; g.vy += ey * f; }
      }
      g.vx *= amort; g.vy *= amort;
      g.x += g.vx; g.y += g.vy;
      const ddx = g.x - C, ddy = g.y - C, dd = Math.hypot(ddx, ddy);
      if (dd > RAYON_VIE) {
        g.x = C + (ddx / dd) * RAYON_VIE; g.y = C + (ddy / dd) * RAYON_VIE;
        g.vx *= -0.35; g.vy *= -0.35;
      }
    }
  }

  function impulsionRadiale(force) {
    for (const g of gouttes) {
      const dx = g.x - C, dy = g.y - C, d = Math.hypot(dx, dy) || 1;
      const f = force + Math.random() * 2.2;
      g.vx += (dx / d) * f; g.vy += (dy / d) * f;
    }
  }

  /* ═══ Rendu WebGL : iso-surface évaluée par pixel sur le GPU ═══ */
  function initWebGL() {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;

    const vs = `
      attribute vec2 a;
      varying vec2 px;
      void main() {
        px = (a * .5 + .5) * ${TAILLE.toFixed(1)};
        gl_Position = vec4(a.x, -a.y, 0., 1.);
      }`;
    const fs = `
      precision mediump float;
      uniform vec3 g[${N}];
      varying vec2 px;
      void main() {
        float f = 0.;
        for (int i = 0; i < ${N}; i++) {
          vec2 d = px - g[i].xy;
          f += g[i].z / (dot(d, d) + 1.);
        }
        // liseré d'or liquide sur le bord, chair bordeaux au cœur
        float a = smoothstep(.72, 1.0, f) * .96;
        // extinction douce avant le bord du canvas : jamais de coupure nette
        a *= smoothstep(${(TAILLE / 2).toFixed(1)}, ${(TAILLE / 2 - 16).toFixed(1)}, distance(px, vec2(${(TAILLE / 2).toFixed(1)})));
        float kChair = clamp((f - 1.08) / 2.4, 0., 1.);
        vec3 or = vec3(.871, .745, .408);
        vec3 chair = mix(vec3(.620, .235, .290), vec3(.447, .184, .216), kChair);
        vec3 col = mix(or, chair, smoothstep(.92, 1.3, f));
        gl_FragColor = vec4(col * a, a);
      }`;

    function compiler(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compiler(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, compiler(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      // un grand triangle couvrant tout l'écran
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const locA = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(locA);
      gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0);

      const locG = gl.getUniformLocation(prog, 'g');
      const tab = new Float32Array(N * 3);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);

      return function dessinerGL() {
        const souffle = 1 + volLisse * 0.40;
        for (let i = 0; i < N; i++) {
          const g = gouttes[i], r = g.r * souffle;
          tab[i * 3] = g.x; tab[i * 3 + 1] = g.y; tab[i * 3 + 2] = r * r;
        }
        gl.uniform3fv(locG, tab);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
    } catch (e) { console.warn('Orbe : WebGL indisponible, repli 2D', e); return null; }
  }

  /* Repli canvas 2D (champ calculé en CPU dans un tampon agrandi) */
  function initCPU() {
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const RES = 128;
    const tampon = document.createElement('canvas');
    tampon.width = RES; tampon.height = RES;
    const ctxT = tampon.getContext('2d');
    const img = ctxT.createImageData(RES, RES);
    const ECH = RES / TAILLE;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    return function dessinerCPU() {
      const souffle = 1 + volLisse * 0.40;
      const d8 = img.data;
      const gs = gouttes.map((g) => ({
        x: g.x * ECH, y: g.y * ECH,
        r2: (g.r * souffle * ECH) * (g.r * souffle * ECH),
      }));
      const CR = RES / 2, FONDU = 16 * ECH; // extinction douce avant le bord
      let i = 0;
      for (let py = 0; py < RES; py++) {
        for (let px = 0; px < RES; px++, i += 4) {
          let f = 0;
          for (const g of gs) {
            const dx = px - g.x, dy = py - g.y;
            f += g.r2 / (dx * dx + dy * dy + 1);
          }
          if (f < 0.72) { d8[i + 3] = 0; continue; }
          const ex = px - CR, ey = py - CR;
          const bord = Math.max(0, Math.min(1, (CR - Math.sqrt(ex * ex + ey * ey)) / FONDU));
          if (f < 1.08) {
            const a = (f - 0.72) / 0.36;
            d8[i] = 222; d8[i + 1] = 190; d8[i + 2] = 104;
            d8[i + 3] = a * a * 230 * bord;
            continue;
          }
          const k = Math.min(1, (f - 1.08) / 2.4);
          d8[i] = 158 - 44 * k; d8[i + 1] = 60 - 13 * k; d8[i + 2] = 74 - 19 * k;
          d8[i + 3] = 244 * bord;
        }
      }
      ctxT.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, TAILLE, TAILLE);
      ctx.drawImage(tampon, 0, 0, TAILLE, TAILLE);
    };
  }

  const dessiner = initWebGL() || initCPU();

  let cadence = 0;
  function boucle() {
    rafId = requestAnimationFrame(boucle);
    if (document.hidden || !el.offsetParent) return;
    cadence++;
    if (etatCourant === 'repos' && cadence % 2) return;
    majVolume();
    physique();
    dessiner();
  }

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
      vol = boostVoix * 0.8; // la matière gonfle aussi via les mots reconnus
    } else vol = 0;
    volLisse += (vol - volLisse) * 0.3;
  }

  function couperMicro() {
    if (flux) { flux.getTracks().forEach((p) => p.stop()); flux = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
    analyseur = null;
  }

  if (reduitMouvement()) { physique(); majVolume(); dessiner(); }
  else boucle();

  return {
    get etat() { return etatCourant; },

    etatVers(nom) {
      etatCourant = nom;
      el.dataset.etat = nom;
      silenceDepuis = 0; boostVoix = 0;
      if (nom !== 'ecoute') couperMicro();
      if (reduitMouvement()) { physique(); dessiner(); }
    },

    /* La reconnaissance vient de transcrire quelque chose : la matière
       encaisse l'éclat de voix. `force` ∈ [0,1] selon la taille du fragment. */
    impulsionVoix(force = 0.5) {
      boostVoix = Math.min(1, boostVoix + 0.35 + force * 0.6);
      impulsionRadiale(1.6 + force * 2.4);
    },

    async ecouter() {
      this.etatVers('ecoute');
      if (reduitMouvement()) return;
      // Android : getUserMedia confisquerait le micro de la reconnaissance
      // vocale (plus aucune transcription) — événements de voix seulement.
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

    detruire() { cancelAnimationFrame(rafId); couperMicro(); },
  };
}
