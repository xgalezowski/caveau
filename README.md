# 🍷 Caveau — Parlez à votre cave

PWA mobile-first : votre cave à vin devient un interlocuteur. 100 % locale
(vos données restent sur votre téléphone), installable sur Android, offline.

## Fonctionnalités

- **Inventaire multi-modal** : texte libre intelligent, dictée vocale (fr-FR),
  photo d'étiquette (lecture IA avec une clé API Claude, optionnelle).
- **Sommelier** : décrivez votre repas → top 3 argumenté depuis VOTRE cave
  (accords mets-vins, maturité, prix vs occasion). Réponse vocale.
- **Mode 🎲 « Ce soir je bois quoi ? »** : surprise pondérée par la maturité.
- **Fenêtres de garde automatiques** par région × couleur × millésime, avec
  cachets « Apogée / À attendre / À boire vite / Sur le déclin ».
- **Sorties de cave** en un tap, journal de dégustation.
- **Veilles** par région / millésime / référence avec seuils → alertes stock bas.
- **Rachat malin** : liens pré-remplis (Wine-Searcher, Vivino, iDealwine, promos)
  + équivalents suggérés par IA.
- **Stats** : valeur de cave, répartitions, pyramide des millésimes, export/import JSON.

## Lancer en local

```sh
python3 -m http.server 8642   # puis http://localhost:8642
node tests/run.js              # harnais de tests des moteurs
```

## Installer sur Android (Samsung)

Ouvrir l'URL publiée dans Chrome → menu ⋮ → « Ajouter à l'écran d'accueil ».
L'app s'installe comme une application native et fonctionne hors-ligne.

## Clé API Claude (optionnelle)

Stats → Réglages → coller une clé `sk-ant-…`. Débloque la lecture photo
d'étiquettes, le « Sommelier+ » en langage naturel et les équivalents de rachat.
La clé ne quitte jamais votre appareil.
