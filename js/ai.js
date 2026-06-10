// Pont IA multi-fournisseur (optionnel — l'app fonctionne entièrement sans).
// La clé se saisit dans Réglages et reste dans le localStorage du téléphone.
//   - Clé « sk-ant-… »  → API Claude (Anthropic)
//   - Autre clé (AQ./AIza…) → API Gemini (Google), avec grounding Google Search
//     pour aller chercher prix et fiches des bouteilles sur le web.

const MODELE_CLAUDE = 'claude-haiku-4-5-20251001';
const MODELE_GEMINI = 'gemini-2.5-flash';

export function fournisseur(apiKey) {
  return apiKey.startsWith('sk-ant') ? 'anthropic' : 'gemini';
}

/* ─── Appels bas niveau ─── */

async function appelerClaude(apiKey, messages, system, maxTokens = 1024) {
  const rep = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODELE_CLAUDE, max_tokens: maxTokens, system, messages }),
  });
  if (!rep.ok) throw await erreurApi(rep);
  const data = await rep.json();
  return data.content?.map((c) => c.text || '').join('') || '';
}

// parts : tableau de parts Gemini ({text} ou {inline_data}).
// rechercheWeb : active le grounding Google Search.
async function appelerGemini(apiKey, parts, system, rechercheWeb = false) {
  const corps = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
  };
  if (rechercheWeb) corps.tools = [{ google_search: {} }];
  const rep = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELE_GEMINI}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) }
  );
  if (!rep.ok) throw await erreurApi(rep);
  const data = await rep.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

async function erreurApi(rep) {
  const detail = await rep.text().catch(() => '');
  return new Error(rep.status === 401 || rep.status === 403
    ? 'Clé API invalide ou refusée'
    : `Erreur API (${rep.status}) ${detail.slice(0, 120)}`);
}

function extraireJSON(texte) {
  const m = texte.replace(/```(?:json)?/g, '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse illisible');
  return JSON.parse(m[0]);
}

/* ─── Lecture d'étiquette (photo) ─── */

const PROMPT_ETIQUETTE = 'Voici une étiquette de bouteille de vin. Réponds UNIQUEMENT avec un JSON : {"nom": string, "domaine": string|null, "appellation": string|null, "region": string|null, "couleur": "rouge"|"blanc"|"rosé"|"effervescent"|"moelleux"|null, "millesime": number|null, "cepages": string[]}. Région parmi : Bordeaux, Bourgogne, Rhône Nord, Rhône Sud, Loire, Alsace, Champagne, Beaujolais, Languedoc, Provence, Sud-Ouest, Jura, Savoie, Corse, Italie, Espagne, Monde.';

export async function analyserEtiquette(apiKey, base64, mediaType) {
  let texte;
  if (fournisseur(apiKey) === 'anthropic') {
    texte = await appelerClaude(apiKey, [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: PROMPT_ETIQUETTE },
      ],
    }], 'Tu es un sommelier expert en lecture d\'étiquettes.', 600);
  } else {
    texte = await appelerGemini(apiKey, [
      { inline_data: { mime_type: mediaType, data: base64 } },
      { text: PROMPT_ETIQUETTE },
    ], 'Tu es un sommelier expert en lecture d\'étiquettes.');
  }
  return extraireJSON(texte);
}

/* ─── Enrichissement web : prix + fiche détaillée ───
   Avec Gemini : vraie recherche Google (grounding). Avec Claude : connaissances
   du modèle, signalées comme estimation. Renvoie :
   { prix: number|null, prixInfo: string, description: string|null }            */

export async function enrichirBouteille(apiKey, b) {
  const libelle = [b.nom, b.domaine, b.appellation || b.region, b.couleur, b.millesime]
    .filter(Boolean).join(' ');
  const consigne = 'Tu es un caviste documentaliste. Pour le vin demandé, donne :\n' +
    '1. "prix" : le prix boutique actuel TTC en euros (cherche sur wine-searcher, idealwine, vinatis, sites de domaines…). Si tu ne trouves pas de prix fiable pour ce vin précis (ou ce millésime), mets null — n\'invente JAMAIS.\n' +
    '2. "description" : une fiche de 60 à 100 mots en français : domaine, cépages, style, arômes, accords, potentiel de garde. Si le vin est introuvable, décris l\'appellation et mets "generique": true.\n' +
    'Réponds UNIQUEMENT en JSON : {"prix": number|null, "description": string, "generique": boolean}';
  let texte;
  let viaWeb = false;
  if (fournisseur(apiKey) === 'gemini') {
    texte = await appelerGemini(apiKey, [{ text: libelle }], consigne, true);
    viaWeb = true;
  } else {
    texte = await appelerClaude(apiKey, [{ role: 'user', content: libelle }], consigne, 700);
  }
  const r = extraireJSON(texte);
  const prix = typeof r.prix === 'number' && r.prix > 0 ? Math.round(r.prix * 10) / 10 : null;
  return {
    prix,
    prixInfo: prix
      ? (viaWeb ? `Prix trouvé sur le web : ${prix} €` : `Prix estimé (IA, non vérifié) : ${prix} €`)
      : 'Prix introuvable sur le web — à compléter si vous le connaissez',
    description: r.description || null,
    generique: !!r.generique,
  };
}

/* ─── Sommelier+ : question libre avec la cave en contexte ─── */

function resumeCave(bottles) {
  return bottles.filter((b) => b.qty > 0).map((b) =>
    `- ${b.nom}${b.millesime ? ' ' + b.millesime : ''} (${b.region}, ${b.couleur}${b.prix ? ', ' + b.prix + '€' : ''}, x${b.qty}, garde ${b.gardeDe}–${b.gardeA})${b.description ? ' — ' + b.description.slice(0, 180) : ''}`
  ).join('\n');
}

export async function sommelierPlus(apiKey, question, bottles) {
  const system = `Tu es le sommelier personnel de l'utilisateur. Voici sa cave actuelle :\n${resumeCave(bottles) || '(cave vide)'}\n` +
    'Réponds en français, chaleureux et précis, 120 mots max. Recommande prioritairement des bouteilles DE SA CAVE (accord, maturité, prix vs occasion), en t\'appuyant sur leurs fiches. Si rien ne convient, dis-le et suggère quoi acheter.';
  if (fournisseur(apiKey) === 'anthropic') {
    return appelerClaude(apiKey, [{ role: 'user', content: question }], system, 700);
  }
  return appelerGemini(apiKey, [{ text: question }], system);
}

/* ─── Équivalents de rachat ─── */

export async function equivalents(apiKey, bottle) {
  const demande = `Je veux racheter ou remplacer : ${bottle.nom} ${bottle.millesime || ''} (${bottle.appellation || bottle.region}, ${bottle.couleur}${bottle.prix ? ', environ ' + bottle.prix + '€' : ''}). Donne 3 alternatives au profil proche (même budget ±30 %), format : « Nom — appellation — prix estimé — pourquoi », une ligne chacune, en français.`;
  const system = 'Tu es un caviste indépendant français au goût sûr.';
  if (fournisseur(apiKey) === 'anthropic') {
    return appelerClaude(apiKey, [{ role: 'user', content: demande }], system, 500);
  }
  return appelerGemini(apiKey, [{ text: demande }], system, true);
}
