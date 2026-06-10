// Pont vers l'API Claude (optionnel — l'app fonctionne entièrement sans).
// La clé reste dans le localStorage du téléphone, les appels partent directement
// du navigateur (en-tête anthropic-dangerous-direct-browser-access).

const API = 'https://api.anthropic.com/v1/messages';
const MODELE = 'claude-haiku-4-5-20251001'; // rapide et économique : idéal vision + chat

async function appeler(apiKey, messages, system, maxTokens = 1024) {
  const rep = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODELE, max_tokens: maxTokens, system, messages }),
  });
  if (!rep.ok) {
    const detail = await rep.text().catch(() => '');
    throw new Error(rep.status === 401 ? 'Clé API invalide' : `Erreur API (${rep.status}) ${detail.slice(0, 120)}`);
  }
  const data = await rep.json();
  return data.content?.map((c) => c.text || '').join('') || '';
}

// Photo d'étiquette → champs structurés de la bouteille.
export async function analyserEtiquette(apiKey, base64, mediaType) {
  const texte = await appeler(apiKey, [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: 'Voici une étiquette de bouteille de vin. Réponds UNIQUEMENT avec un JSON : {"nom": string, "domaine": string|null, "appellation": string|null, "region": string|null, "couleur": "rouge"|"blanc"|"rosé"|"effervescent"|"moelleux"|null, "millesime": number|null, "cepages": string[], "prixEstime": number|null}. Région parmi : Bordeaux, Bourgogne, Rhône Nord, Rhône Sud, Loire, Alsace, Champagne, Beaujolais, Languedoc, Provence, Sud-Ouest, Jura, Savoie, Corse, Italie, Espagne, Monde. prixEstime = prix boutique typique en euros.' },
    ],
  }], 'Tu es un sommelier expert en lecture d\'étiquettes.', 600);
  const m = texte.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse illisible');
  return JSON.parse(m[0]);
}

// Question libre au « Sommelier+ » avec la cave en contexte.
export async function sommelierPlus(apiKey, question, bottles) {
  const cave = bottles.filter((b) => b.qty > 0).map((b) =>
    `- ${b.nom}${b.millesime ? ' ' + b.millesime : ''} (${b.region}, ${b.couleur}${b.prix ? ', ' + b.prix + '€' : ''}, x${b.qty}, garde ${b.gardeDe}–${b.gardeA})`
  ).join('\n');
  return appeler(apiKey, [{ role: 'user', content: question }],
    `Tu es le sommelier personnel de l'utilisateur. Voici sa cave actuelle :\n${cave || '(cave vide)'}\n` +
    'Réponds en français, chaleureux et précis, 120 mots max. Recommande prioritairement des bouteilles DE SA CAVE (accord, maturité, prix vs occasion). Si rien ne convient, dis-le et suggère quoi acheter.',
    700);
}

// Suggestions d'équivalents à racheter pour une référence donnée.
export async function equivalents(apiKey, bottle) {
  return appeler(apiKey, [{
    role: 'user',
    content: `Je veux racheter ou remplacer : ${bottle.nom} ${bottle.millesime || ''} (${bottle.appellation || bottle.region}, ${bottle.couleur}${bottle.prix ? ', environ ' + bottle.prix + '€' : ''}). Donne 3 alternatives au profil proche (même budget ±30 %), format : « Nom — appellation — prix estimé — pourquoi », une ligne chacune, en français.`,
  }], 'Tu es un caviste indépendant français au goût sûr.', 500);
}
