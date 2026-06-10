# Caveau — « Parlez à votre cave » — Design Doc

Date : 2026-06-10 · Statut : validé (mode autonome, délégation explicite de l'utilisateur)

## Vision

Une PWA mobile-first ultra soignée qui transforme la cave à vin de Xavier en interlocuteur :
on lui **dicte / écrit / photographie** ses bouteilles, on lui **demande conseil** pour un repas,
on **sort une bouteille** en un tap, elle **alerte** quand un segment surveillé devient bas et
**facilite le rachat**. Utilisable sur Samsung (Chrome Android), installable, offline-first.

## Approches envisagées

1. **PWA statique 100 % locale + IA optionnelle par clé API** ← retenue.
   - ✅ Zéro backend, données privées sur l'appareil, installable, déployable en 1 min.
   - ✅ Voix gratuite via Web Speech API (excellente sur Chrome Android).
   - ⚠️ Vision photo et chat libre nécessitent une clé Anthropic (optionnelle, fallback local).
2. App React + backend (Supabase) : sync multi-appareils mais friction (comptes, hébergement,
   coûts) disproportionnée pour un usage personnel. Rejetée (YAGNI).
3. App native Android : distribution complexe (APK/Play Store). Rejetée.

## Architecture

- **Stack** : HTML/CSS/JS vanilla, modules ES, aucun build. PWA complète
  (`manifest.webmanifest`, `sw.js` cache-first, icônes).
- **Données** : `localStorage` (JSON versionné), export/import JSON (backup).
- **IA** :
  - *Voix* : Web Speech API `fr-FR` (dictée d'ajout + questions au sommelier) ;
    `speechSynthesis` pour que la cave « réponde » à voix haute.
  - *Photo* : capture caméra → si clé API Claude configurée, vision (modèle haiku) extrait
    domaine/appellation/millésime ; sinon saisie assistée.
  - *Sommelier* : moteur d'accords **local à règles œnologiques** (toujours dispo) ; si clé
    API, un mode « Sommelier+ » en langage naturel enrichit la réponse.
  - Appels API directs navigateur (`anthropic-dangerous-direct-browser-access`), clé stockée
    localement uniquement.

## Modules

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille, écrans, bottom-nav |
| `css/style.css` | Design system « cave voûtée » |
| `js/store.js` | État, persistance, migrations, export/import |
| `js/wine-data.js` | Référentiel : régions, appellations, cépages, fenêtres de garde |
| `js/parser.js` | Parsing texte/dictée → bouteille structurée |
| `js/sommelier.js` | Moteur d'accords mets-vins (plat, sauce, intensité, occasion, prix, apogée) |
| `js/ai.js` | Pont Claude API (vision étiquette, sommelier+) |
| `js/voice.js` | Dictée + synthèse vocale |
| `js/ui.js` | Rendu écrans, interactions, toasts |
| `js/app.js` | Bootstrap, navigation, service worker |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |

## Modèle de données (bouteille)

`{ id, nom, domaine, appellation, region, couleur (rouge|blanc|rosé|effervescent|moelleux),
millesime, cepages[], prix, qty, gardeDe, gardeA (calculés auto, éditables), notes,
ajoutLe, sorties: [{date, occasion, note}] }`
+ `watches: [{type: region|millesime|reference, valeur, seuil}]`
+ `settings: { apiKey?, voix, objectifs }`

## Écrans (bottom-nav 5 onglets)

1. **Cave** : inventaire groupé (région/couleur/apogée), recherche, badges maturité
   (`à boire`, `apogée`, `attendre`, `urgent`), valeur totale, fiche détaillée.
2. **Ajouter** : 3 modes — ✍️ texte libre parsé, 🎙️ dictée vocale, 📷 photo étiquette.
   Confirmation par carte pré-remplie éditable.
3. **Sommelier** (écran central, star) : décris ton repas (texte ou voix) →
   recommandation argumentée top-3 depuis TA cave (accord, maturité, prix vs occasion),
   réponse vocale optionnelle. Mode « Ce soir je bois quoi ? » (surprise intelligente).
4. **Alertes** : veilles configurables (région/millésime/référence + seuil), alertes stock bas,
   bouteilles en zone « urgent à boire », et **rachat malin** : liens pré-remplis
   (Wine-Searcher, idéalwine, Vivino, Google Shopping) + équivalents suggérés depuis le profil.
5. **Stats** : valeur de cave, répartition couleurs/régions (jauges), pyramide des millésimes,
   journal des sorties, export/import JSON, réglages (clé API, voix).

## Design system

- Palette : fond `#120a0d` (noir lie-de-vin), surfaces `#1d1216`, bordeaux `#722f37`,
  accent or `#c9a227`, crème `#f3ead8`.
- Typo : Cormorant Garamond (titres, italiques élégantes) + Inter (UI). Chargées via Google Fonts
  avec fallback système offline.
- Cartes en relief doux, séparateurs filigrane, micro-animations (entrées en fondu, tap states),
  grandes zones tactiles (≥44px), safe-areas Android.

## Gestion d'erreurs

- Parsing raté → formulaire manuel pré-rempli au mieux, jamais bloquant.
- API absente/erreur → fallback local explicite (bandeau discret).
- Web Speech non dispo → bouton micro masqué avec explication.
- localStorage plein/corrompu → sauvegarde de secours + invite d'export.

## Tests / Vérification

Pas de framework de test (app statique) : vérification par scénarios manuels via
serveur local + contrôles automatiques légers (fonctions pures du parser et du sommelier
testées par un petit harnais `node tests/run.js`).

## Hors scope (v1)

Sync multi-appareils, scan code-barres, prix temps réel via scraping, comptes utilisateurs.
