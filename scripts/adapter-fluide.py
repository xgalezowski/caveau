#!/usr/bin/env python3
"""Transforme le script.js de PavelDoGreat/WebGL-Fluid-Simulation (MIT)
en module ES « js/fluide-sim.js » pour Caveau :
- retire promo, GUI, capture d'écran, analytics, raccourcis clavier
- enveloppe tout dans `export function creerSimulation(canvas, surcharges)`
- palette de couleurs injectable (config.PALETTE)
- mode veille (config.DORMIR) pour économiser la batterie hors écran
"""
import re

src = open('/tmp/fluid-sim.js').read()

def couper(texte, debut, fin, garder_fin=True):
    """Supprime de `debut` (inclus) à `fin` (exclu si garder_fin)."""
    i = texte.index(debut)
    j = texte.index(fin, i)
    return texte[:i] + (texte[j:] if garder_fin else texte[j + len(fin):])

# 1. Bloc promo / liens magasins
src = couper(src, "const promoPopup", "// Simulation section")

# 2. Le canvas devient un paramètre
src = src.replace("const canvas = document.getElementsByTagName('canvas')[0];\n", "")

# 3. GUI (dat.gui) et son appel
src = src.replace("startGUI();\n", "")
src = couper(src, "function startGUI () {", "function isMobile () {")

# 4. Capture d'écran et ses utilitaires (jusqu'au prochain bloc conservé)
src = couper(src, "function captureScreenshot () {", "class Material {")

# 5. Analytics et raccourcis clavier
src = re.sub(r"^.*ga\('send'.*\n", "", src, flags=re.M)
src = couper(src, "window.addEventListener('keydown'", "function updatePointerDownData")

# 6. Surcharges de config juste après sa définition
src = src.replace(
    "    SUNRAYS_WEIGHT: 1.0,\n}",
    "    SUNRAYS_WEIGHT: 1.0,\n    PALETTE: null,\n    DORMIR: false,\n}\nObject.assign(config, surcharges);",
    1,
)

# 6 bis. preserveDrawingBuffer pilotable (les captures d'écran headless ne
# peuvent pas lire un canvas WebGL sans lui — utile en debug/preview)
src = src.replace(
    "preserveDrawingBuffer: false };",
    "preserveDrawingBuffer: !!config.PRESERVE };",
    1,
)
src = src.replace(
    "    PALETTE: null,\n    DORMIR: false,",
    "    PALETTE: null,\n    DORMIR: false,\n    PRESERVE: false,",
    1,
)

# 7. Palette injectable dans generateColor
src = src.replace(
    """function generateColor () {
    let c = HSVtoRGB(Math.random(), 1.0, 1.0);""",
    """function generateColor () {
    if (config.PALETTE && config.PALETTE.length) {
        const base = config.PALETTE[Math.floor(Math.random() * config.PALETTE.length)];
        return { r: base.r, g: base.g, b: base.b };
    }
    let c = HSVtoRGB(Math.random(), 1.0, 1.0);""",
    1,
)

# 8. Mode veille dans la boucle
src = src.replace(
    """function update () {
    const dt = calcDeltaTime();
    if (resizeCanvas())
        initFramebuffers();
    updateColors(dt);
    applyInputs();
    if (!config.PAUSED)
        step(dt);
    render(null);
    requestAnimationFrame(update);
}""",
    """function update () {
    requestAnimationFrame(update); // replanifié D'ABORD : la boucle survit à toute exception
    const dt = calcDeltaTime();
    if (config.DORMIR) return;
    try {
        if (resizeCanvas())
            initFramebuffers();
        updateColors(dt);
        applyInputs();
        if (!config.PAUSED)
            step(dt);
        render(null);
    } catch (e) {
        if (!update.signale) { update.signale = true; console.warn('Simulation fluide en erreur :', e); }
    }
}""",
    1,
)

# 8 bis. VRAIE transparence : la démo d'origine peint un DAMIER en mode
# TRANSPARENT (pour matérialiser l'alpha) — on efface en transparent à la
# place, et on garde le blending premultiplié pour composer sur la page.
src = src.replace(
    """    if (target == null || !config.TRANSPARENT) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
    }
    else {
        gl.disable(gl.BLEND);
    }

    if (!config.TRANSPARENT)
        drawColor(target, normalizeColor(config.BACK_COLOR));
    if (target == null && config.TRANSPARENT)
        drawCheckerboard(target);
    drawDisplay(target);""",
    """    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    if (!config.TRANSPARENT)
        drawColor(target, normalizeColor(config.BACK_COLOR));
    else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target == null ? null : target.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    drawDisplay(target);""",
    1,
)

# 9. Éclaboussure initiale plus sobre
src = src.replace("multipleSplats(parseInt(Math.random() * 20) + 5);", "multipleSplats(4);", 1)

# 10. Enveloppe module
entete = """// Simulation de fluide WebGL (Navier-Stokes GPU).
// Adapté de PavelDoGreat/WebGL-Fluid-Simulation — Copyright (c) 2017 Pavel
// Dobryakov, licence MIT (https://github.com/PavelDoGreat/WebGL-Fluid-Simulation).
// Modifications Caveau : module ES, canvas en paramètre, palette injectable,
// mode veille, retrait GUI / capture / analytics. NE PAS reformater à la main.

export function creerSimulation (canvas, surcharges = {}) {
"""
pied = """
    return {
        config,
        splat,
        multipleSplats,
        generateColor,
    };
}
"""
# retire le shebang/licence d'origine en tête (commentaires avant 'use strict')
i = src.index("'use strict';")
src = src[i:]
# 'use strict' est ILLÉGAL dans une fonction à paramètres par défaut, et les
# modules ES sont stricts d'office : on retire la directive.
src = src.replace("'use strict';", "", 1)
src = entete + src + pied

open('/Users/x.galezowski/Dev/Talk-to-my-Cave/js/fluide-sim.js', 'w').write(src)
print('js/fluide-sim.js écrit :', len(src.splitlines()), 'lignes')
