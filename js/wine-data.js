// Référentiel œnologique : pays, régions, fenêtres de garde, appellations,
// profils d'accords, types de spiritueux.
// Module pur (aucune dépendance DOM) — importable côté navigateur et Node (tests).

export const COULEURS = ['rouge', 'blanc', 'rosé', 'effervescent', 'moelleux'];
export const FORMATS = ['37,5 cl', '50 cl', '75 cl', 'Magnum 1,5 L', 'Jéroboam 3 L', 'Autre'];

export const TYPES_SPIRITUEUX = ['Whisky', 'Rhum', 'Gin', 'Cognac', 'Armagnac', 'Calvados', 'Eau-de-vie', 'Vodka', 'Tequila / Mezcal', 'Anisé', 'Liqueur', 'Autre'];

// Fenêtres de garde par défaut (années après le millésime) : [début apogée, fin apogée]
export const GARDE = {
  // France
  'Bordeaux':        { rouge: [5, 20], blanc: [2, 8],  moelleux: [5, 30], 'rosé': [1, 3] },
  'Bourgogne':       { rouge: [4, 15], blanc: [3, 10] },
  'Rhône Nord':      { rouge: [5, 18], blanc: [2, 8] },
  'Rhône Sud':       { rouge: [3, 12], blanc: [1, 5],  'rosé': [1, 2] },
  'Loire':           { rouge: [3, 10], blanc: [2, 8],  moelleux: [5, 40], effervescent: [1, 4] },
  'Alsace':          { blanc: [2, 10], moelleux: [5, 25], effervescent: [1, 4] },
  'Champagne':       { effervescent: [2, 10] },
  'Beaujolais':      { rouge: [1, 5] },
  'Languedoc':       { rouge: [2, 8],  blanc: [1, 4],  'rosé': [1, 2], moelleux: [3, 20] },
  'Provence':        { 'rosé': [0, 2], rouge: [3, 10], blanc: [1, 4] },
  'Sud-Ouest':       { rouge: [3, 12], blanc: [1, 5],  moelleux: [4, 25] },
  'Jura':            { blanc: [3, 20], rouge: [2, 8],  effervescent: [1, 4] },
  'Savoie':          { blanc: [1, 4],  rouge: [1, 4] },
  'Corse':           { rouge: [2, 8],  blanc: [1, 4],  'rosé': [1, 2] },
  'Vin de France':   { rouge: [1, 5],  blanc: [1, 3],  'rosé': [0, 2], effervescent: [1, 3] },
  // Italie
  'Piémont':         { rouge: [5, 20], blanc: [1, 5] },
  'Toscane':         { rouge: [4, 15] },
  'Vénétie':         { rouge: [3, 12], blanc: [1, 4], effervescent: [1, 3] },
  'Sicile':          { rouge: [2, 8],  blanc: [1, 4] },
  'Abruzzes':        { rouge: [2, 8] },
  'Pouilles':        { rouge: [2, 6] },
  'Campanie':        { rouge: [4, 12], blanc: [1, 5] },
  'Lombardie':       { effervescent: [2, 8], rouge: [3, 10] },
  // Espagne
  'Rioja':           { rouge: [4, 15], blanc: [2, 8] },
  'Ribera del Duero': { rouge: [4, 15] },
  'Priorat':         { rouge: [4, 15] },
  'Galice':          { blanc: [1, 4] },
  'Catalogne':       { rouge: [3, 12], effervescent: [1, 4] },
  'Castille':        { rouge: [3, 10], blanc: [1, 4] },
  'Andalousie':      { moelleux: [2, 30], blanc: [2, 20] },
  // Argentine / Chili
  'Mendoza':         { rouge: [3, 12], blanc: [1, 4] },
  'Salta':           { rouge: [3, 10], blanc: [1, 4] },
  'Patagonie':       { rouge: [2, 8],  blanc: [1, 4] },
  'Vallée de Maipo': { rouge: [3, 10] },
  'Colchagua':       { rouge: [3, 10] },
  'Casablanca':      { blanc: [1, 4] },
  // Géorgie
  'Kakhétie':        { rouge: [3, 12], blanc: [2, 8] },
  'Karthlie':        { rouge: [2, 8],  blanc: [2, 6] },
  'Iméréthie':       { rouge: [2, 8],  blanc: [2, 6] },
  // Allemagne
  'Moselle':         { blanc: [2, 15], moelleux: [5, 30] },
  'Rheingau':        { blanc: [2, 12], moelleux: [5, 30] },
  'Palatinat':       { blanc: [2, 10], rouge: [2, 8] },
  'Rheinhessen':     { blanc: [2, 8] },
  'Bade':            { rouge: [2, 8],  blanc: [1, 6] },
  'Franconie':       { blanc: [2, 8] },
  // Grèce
  'Santorin':        { blanc: [2, 8],  moelleux: [5, 25] },
  'Naoussa':         { rouge: [4, 15] },
  'Némée':           { rouge: [3, 10] },
  'Mantinée':        { blanc: [1, 4] },
  'Crète':           { rouge: [2, 6],  blanc: [1, 4] },
  // Portugal / USA (essentiels)
  'Douro':           { rouge: [4, 15], moelleux: [5, 40] },
  'Vinho Verde':     { blanc: [0, 2] },
  'Alentejo':        { rouge: [2, 8] },
  'Napa Valley':     { rouge: [4, 15] },
  'Sonoma':          { rouge: [3, 12], blanc: [1, 6] },
  'Oregon':          { rouge: [3, 10] },
  // Héritage (anciennes « régions » génériques, conservées pour compatibilité)
  'Italie':          { rouge: [4, 15], blanc: [1, 5],  effervescent: [1, 3] },
  'Espagne':         { rouge: [4, 15], blanc: [1, 5] },
  'Monde':           { rouge: [3, 12], blanc: [1, 6],  'rosé': [1, 2], effervescent: [1, 5], moelleux: [3, 15] },
};
export const REGIONS = Object.keys(GARDE);
const DEFAUT_GARDE = { rouge: [3, 10], blanc: [1, 5], 'rosé': [1, 2], effervescent: [1, 5], moelleux: [3, 15] };

// Hiérarchie pays → régions (pour filtrer les listes déroulantes)
export const REGIONS_PAR_PAYS = {
  'France': ['Bordeaux', 'Bourgogne', 'Rhône Nord', 'Rhône Sud', 'Loire', 'Alsace', 'Champagne', 'Beaujolais', 'Languedoc', 'Provence', 'Sud-Ouest', 'Jura', 'Savoie', 'Corse', 'Vin de France'],
  'Italie': ['Piémont', 'Toscane', 'Vénétie', 'Sicile', 'Abruzzes', 'Pouilles', 'Campanie', 'Lombardie'],
  'Espagne': ['Rioja', 'Ribera del Duero', 'Priorat', 'Galice', 'Catalogne', 'Castille', 'Andalousie'],
  'Argentine': ['Mendoza', 'Salta', 'Patagonie'],
  'Chili': ['Vallée de Maipo', 'Colchagua', 'Casablanca'],
  'Géorgie': ['Kakhétie', 'Karthlie', 'Iméréthie'],
  'Allemagne': ['Moselle', 'Rheingau', 'Palatinat', 'Rheinhessen', 'Bade', 'Franconie'],
  'Grèce': ['Santorin', 'Naoussa', 'Némée', 'Mantinée', 'Crète'],
  'Portugal': ['Douro', 'Vinho Verde', 'Alentejo'],
  'États-Unis': ['Napa Valley', 'Sonoma', 'Oregon'],
};
export const PAYS = ['France', 'Italie', 'Espagne', 'Argentine', 'Chili', 'Géorgie', 'Allemagne', 'Grèce', 'Portugal', 'Suisse', 'Autriche', 'États-Unis', 'Afrique du Sud', 'Australie', 'Nouvelle-Zélande'];

export function regionsPour(pays) {
  return REGIONS_PAR_PAYS[pays] || [];
}
const PAYS_DE_REGION = {};
for (const [p, regs] of Object.entries(REGIONS_PAR_PAYS)) regs.forEach((r) => { PAYS_DE_REGION[r] = p; });
PAYS_DE_REGION['Italie'] = 'Italie'; PAYS_DE_REGION['Espagne'] = 'Espagne';
export function paysParDefaut(region) {
  if (region === 'Monde') return null;
  return PAYS_DE_REGION[region] || 'France';
}

// Corps du vin par région/couleur : 1 léger · 2 moyen · 3 puissant
export const CORPS = {
  'Bordeaux|rouge': 3, 'Bourgogne|rouge': 2, 'Rhône Nord|rouge': 3, 'Rhône Sud|rouge': 3,
  'Loire|rouge': 1, 'Beaujolais|rouge': 1, 'Languedoc|rouge': 3, 'Sud-Ouest|rouge': 3,
  'Provence|rouge': 2, 'Corse|rouge': 2, 'Jura|rouge': 1, 'Vin de France|rouge': 2,
  'Bourgogne|blanc': 2, 'Bordeaux|blanc': 2, 'Loire|blanc': 1, 'Alsace|blanc': 2,
  'Rhône Nord|blanc': 3, 'Rhône Sud|blanc': 2, 'Jura|blanc': 3, 'Savoie|blanc': 1,
  'Piémont|rouge': 3, 'Toscane|rouge': 3, 'Vénétie|rouge': 2, 'Sicile|rouge': 2,
  'Campanie|rouge': 3, 'Italie|rouge': 3,
  'Rioja|rouge': 2, 'Ribera del Duero|rouge': 3, 'Priorat|rouge': 3, 'Espagne|rouge': 3,
  'Galice|blanc': 1, 'Casablanca|blanc': 2,
  'Mendoza|rouge': 3, 'Salta|rouge': 3, 'Vallée de Maipo|rouge': 3, 'Colchagua|rouge': 3,
  'Kakhétie|rouge': 3, 'Naoussa|rouge': 3, 'Némée|rouge': 2,
  'Moselle|blanc': 1, 'Rheingau|blanc': 2, 'Santorin|blanc': 2,
  'Douro|rouge': 3, 'Napa Valley|rouge': 3, 'Oregon|rouge': 2,
};
export function corpsDe(region, couleur) {
  return CORPS[`${region}|${couleur}`] ?? 2;
}

// Caractères de dégustation par région|couleur : cépages dominants et notes
// typiques. Nourrit les argumentaires personnalisés du sommelier.
export const CARACTERES = {
  'Bordeaux|rouge': { cep: 'cabernet sauvignon et merlot', notes: 'cassis, cèdre et tabac blond' },
  'Bordeaux|blanc': { cep: 'sauvignon et sémillon', notes: 'pamplemousse, buis et cire' },
  'Bourgogne|rouge': { cep: 'pinot noir', notes: 'griotte, sous-bois et épices douces' },
  'Bourgogne|blanc': { cep: 'chardonnay', notes: 'noisette, beurre frais et fleurs blanches' },
  'Rhône Nord|rouge': { cep: 'syrah', notes: 'poivre noir, violette et olive' },
  'Rhône Nord|blanc': { cep: 'viognier ou marsanne', notes: 'abricot, miel et aubépine' },
  'Rhône Sud|rouge': { cep: 'grenache et syrah', notes: 'garrigue, fruits noirs et réglisse' },
  'Loire|blanc': { cep: 'sauvignon ou chenin', notes: 'agrumes, pierre à fusil et fleurs' },
  'Loire|rouge': { cep: 'cabernet franc', notes: 'framboise, poivron doux et craie' },
  'Alsace|blanc': { cep: 'riesling ou gewurztraminer', notes: 'citron confit, litchi et minéralité' },
  'Champagne|effervescent': { cep: 'chardonnay et pinots', notes: 'brioche, pomme verte et craie' },
  'Beaujolais|rouge': { cep: 'gamay', notes: 'griotte, pivoine et fraîcheur croquante' },
  'Languedoc|rouge': { cep: 'syrah, grenache et mourvèdre', notes: 'thym, cuir et fruits mûrs' },
  'Provence|rosé': { cep: 'grenache et cinsault', notes: 'pêche blanche, agrumes et garrigue' },
  'Provence|rouge': { cep: 'mourvèdre et grenache', notes: 'mûre, laurier et poivre' },
  'Sud-Ouest|rouge': { cep: 'malbec et tannat', notes: 'mûre, violette et encre' },
  'Jura|blanc': { cep: 'savagnin', notes: 'noix fraîche, curry doux et pomme' },
  'Savoie|blanc': { cep: 'jacquère ou altesse', notes: 'pierre alpine, poire et fleurs blanches' },
  'Corse|rouge': { cep: 'niellucciu et sciaccarellu', notes: 'maquis, cerise et poivre' },
  'Piémont|rouge': { cep: 'nebbiolo', notes: 'rose fanée, goudron noble et griotte' },
  'Toscane|rouge': { cep: 'sangiovese', notes: 'cerise amère, cuir et laurier' },
  'Vénétie|rouge': { cep: 'corvina', notes: 'cerise confite, amande et épices' },
  'Sicile|rouge': { cep: 'nero d\'avola ou nerello', notes: 'fruits noirs, lave et orange sanguine' },
  'Rioja|rouge': { cep: 'tempranillo', notes: 'fruits rouges compotés, vanille et cuir' },
  'Ribera del Duero|rouge': { cep: 'tempranillo', notes: 'mûre profonde, torréfaction et velours' },
  'Priorat|rouge': { cep: 'grenache et carignan', notes: 'schiste chaud, kirsch et minéral' },
  'Galice|blanc': { cep: 'albariño', notes: 'pêche, embruns et zeste' },
  'Mendoza|rouge': { cep: 'malbec', notes: 'prune, violette et moka' },
  'Vallée de Maipo|rouge': { cep: 'cabernet sauvignon', notes: 'cassis, eucalyptus et graphite' },
  'Casablanca|blanc': { cep: 'sauvignon ou chardonnay', notes: 'agrumes vifs et brise marine' },
  'Napa Valley|rouge': { cep: 'cabernet sauvignon', notes: 'cassis crémeux, cèdre et chocolat' },
  'Oregon|rouge': { cep: 'pinot noir', notes: 'cerise rouge, terre humide et rose' },
  'Moselle|blanc': { cep: 'riesling', notes: 'citron vert, ardoise et miel léger' },
  'Rheingau|blanc': { cep: 'riesling', notes: 'pêche, épices et tension saline' },
  'Kakhétie|rouge': { cep: 'saperavi', notes: 'mûre sauvage, grenade et tanins fougueux' },
  'Santorin|blanc': { cep: 'assyrtiko', notes: 'citron, sel et pierre volcanique' },
  'Naoussa|rouge': { cep: 'xinomavro', notes: 'tomate séchée, rose et tanins fins' },
  'Douro|rouge': { cep: 'touriga nacional', notes: 'fruits noirs, schiste et fleurs' },
  'Alentejo|rouge': { cep: 'aragonez et trincadeira', notes: 'fruits mûrs, herbes sèches et soleil' },
};
export function caractereDe(region, couleur) {
  return CARACTERES[`${region}|${String(couleur || '').toLowerCase()}`] || null;
}

// Appellations connues → { r: région, c: couleur dominante, p: pays (si hors France) }
// Sert au parsing texte/dictée et aux suggestions d'équivalents.
export const APPELLATIONS = {
  // ── Bordeaux
  'margaux': { r: 'Bordeaux', c: 'rouge' }, 'pauillac': { r: 'Bordeaux', c: 'rouge' },
  'saint-julien': { r: 'Bordeaux', c: 'rouge' }, 'saint-estèphe': { r: 'Bordeaux', c: 'rouge' },
  'pessac-léognan': { r: 'Bordeaux', c: 'rouge' }, 'graves': { r: 'Bordeaux', c: 'rouge' },
  'saint-émilion': { r: 'Bordeaux', c: 'rouge' }, 'pomerol': { r: 'Bordeaux', c: 'rouge' },
  'lalande-de-pomerol': { r: 'Bordeaux', c: 'rouge' }, 'fronsac': { r: 'Bordeaux', c: 'rouge' },
  'canon-fronsac': { r: 'Bordeaux', c: 'rouge' }, 'médoc': { r: 'Bordeaux', c: 'rouge' },
  'haut-médoc': { r: 'Bordeaux', c: 'rouge' }, 'listrac': { r: 'Bordeaux', c: 'rouge' },
  'moulis': { r: 'Bordeaux', c: 'rouge' }, 'castillon': { r: 'Bordeaux', c: 'rouge' },
  'côtes de bourg': { r: 'Bordeaux', c: 'rouge' }, 'blaye': { r: 'Bordeaux', c: 'rouge' },
  'sauternes': { r: 'Bordeaux', c: 'moelleux' }, 'barsac': { r: 'Bordeaux', c: 'moelleux' },
  'loupiac': { r: 'Bordeaux', c: 'moelleux' }, 'cadillac': { r: 'Bordeaux', c: 'moelleux' },
  'sainte-croix-du-mont': { r: 'Bordeaux', c: 'moelleux' },
  'entre-deux-mers': { r: 'Bordeaux', c: 'blanc' },
  // ── Bourgogne
  'chablis': { r: 'Bourgogne', c: 'blanc' }, 'petit chablis': { r: 'Bourgogne', c: 'blanc' },
  'meursault': { r: 'Bourgogne', c: 'blanc' }, 'puligny-montrachet': { r: 'Bourgogne', c: 'blanc' },
  'chassagne-montrachet': { r: 'Bourgogne', c: 'blanc' }, 'montrachet': { r: 'Bourgogne', c: 'blanc' },
  'bâtard-montrachet': { r: 'Bourgogne', c: 'blanc' }, 'corton-charlemagne': { r: 'Bourgogne', c: 'blanc' },
  'pouilly-fuissé': { r: 'Bourgogne', c: 'blanc' }, 'pouilly-loché': { r: 'Bourgogne', c: 'blanc' },
  'mâcon': { r: 'Bourgogne', c: 'blanc' }, 'viré-clessé': { r: 'Bourgogne', c: 'blanc' },
  'saint-véran': { r: 'Bourgogne', c: 'blanc' }, 'rully': { r: 'Bourgogne', c: 'blanc' },
  'saint-aubin': { r: 'Bourgogne', c: 'blanc' }, 'saint-bris': { r: 'Bourgogne', c: 'blanc' },
  'auxey-duresses': { r: 'Bourgogne', c: 'blanc' },
  'gevrey-chambertin': { r: 'Bourgogne', c: 'rouge' }, 'chambertin': { r: 'Bourgogne', c: 'rouge' },
  'chambolle-musigny': { r: 'Bourgogne', c: 'rouge' }, 'musigny': { r: 'Bourgogne', c: 'rouge' },
  'vosne-romanée': { r: 'Bourgogne', c: 'rouge' }, 'romanée': { r: 'Bourgogne', c: 'rouge' },
  'échezeaux': { r: 'Bourgogne', c: 'rouge' }, 'richebourg': { r: 'Bourgogne', c: 'rouge' },
  'nuits-saint-georges': { r: 'Bourgogne', c: 'rouge' }, 'pommard': { r: 'Bourgogne', c: 'rouge' },
  'volnay': { r: 'Bourgogne', c: 'rouge' }, 'monthélie': { r: 'Bourgogne', c: 'rouge' },
  'beaune': { r: 'Bourgogne', c: 'rouge' }, 'savigny': { r: 'Bourgogne', c: 'rouge' },
  'aloxe-corton': { r: 'Bourgogne', c: 'rouge' }, 'pernand-vergelesses': { r: 'Bourgogne', c: 'rouge' },
  'ladoix': { r: 'Bourgogne', c: 'rouge' }, 'santenay': { r: 'Bourgogne', c: 'rouge' },
  'mercurey': { r: 'Bourgogne', c: 'rouge' }, 'givry': { r: 'Bourgogne', c: 'rouge' },
  'corton': { r: 'Bourgogne', c: 'rouge' }, 'clos de vougeot': { r: 'Bourgogne', c: 'rouge' },
  'clos de la roche': { r: 'Bourgogne', c: 'rouge' }, 'clos de tart': { r: 'Bourgogne', c: 'rouge' },
  'bonnes-mares': { r: 'Bourgogne', c: 'rouge' }, 'morey-saint-denis': { r: 'Bourgogne', c: 'rouge' },
  'marsannay': { r: 'Bourgogne', c: 'rouge' }, 'fixin': { r: 'Bourgogne', c: 'rouge' },
  'irancy': { r: 'Bourgogne', c: 'rouge' },
  // ── Beaujolais
  'morgon': { r: 'Beaujolais', c: 'rouge' }, 'fleurie': { r: 'Beaujolais', c: 'rouge' },
  'moulin-à-vent': { r: 'Beaujolais', c: 'rouge' }, 'brouilly': { r: 'Beaujolais', c: 'rouge' },
  'côte de brouilly': { r: 'Beaujolais', c: 'rouge' }, 'juliénas': { r: 'Beaujolais', c: 'rouge' },
  'chiroubles': { r: 'Beaujolais', c: 'rouge' }, 'chénas': { r: 'Beaujolais', c: 'rouge' },
  'régnié': { r: 'Beaujolais', c: 'rouge' }, 'saint-amour': { r: 'Beaujolais', c: 'rouge' },
  'beaujolais': { r: 'Beaujolais', c: 'rouge' },
  // ── Rhône
  'côte-rôtie': { r: 'Rhône Nord', c: 'rouge' }, 'hermitage': { r: 'Rhône Nord', c: 'rouge' },
  'crozes-hermitage': { r: 'Rhône Nord', c: 'rouge' }, 'cornas': { r: 'Rhône Nord', c: 'rouge' },
  'saint-joseph': { r: 'Rhône Nord', c: 'rouge' }, 'condrieu': { r: 'Rhône Nord', c: 'blanc' },
  'château-grillet': { r: 'Rhône Nord', c: 'blanc' }, 'saint-péray': { r: 'Rhône Nord', c: 'blanc' },
  'châteauneuf-du-pape': { r: 'Rhône Sud', c: 'rouge' }, 'gigondas': { r: 'Rhône Sud', c: 'rouge' },
  'vacqueyras': { r: 'Rhône Sud', c: 'rouge' }, 'rasteau': { r: 'Rhône Sud', c: 'rouge' },
  'cairanne': { r: 'Rhône Sud', c: 'rouge' }, 'lirac': { r: 'Rhône Sud', c: 'rouge' },
  'vinsobres': { r: 'Rhône Sud', c: 'rouge' }, 'beaumes-de-venise': { r: 'Rhône Sud', c: 'rouge' },
  'tavel': { r: 'Rhône Sud', c: 'rosé' }, 'côtes-du-rhône': { r: 'Rhône Sud', c: 'rouge' },
  'ventoux': { r: 'Rhône Sud', c: 'rouge' }, 'costières de nîmes': { r: 'Rhône Sud', c: 'rouge' },
  // ── Loire
  'sancerre': { r: 'Loire', c: 'blanc' }, 'pouilly-fumé': { r: 'Loire', c: 'blanc' },
  'menetou-salon': { r: 'Loire', c: 'blanc' }, 'quincy': { r: 'Loire', c: 'blanc' },
  'reuilly': { r: 'Loire', c: 'blanc' }, 'vouvray': { r: 'Loire', c: 'blanc' },
  'montlouis': { r: 'Loire', c: 'blanc' }, 'savennières': { r: 'Loire', c: 'blanc' },
  'jasnières': { r: 'Loire', c: 'blanc' }, 'cheverny': { r: 'Loire', c: 'blanc' },
  'muscadet': { r: 'Loire', c: 'blanc' }, 'touraine': { r: 'Loire', c: 'blanc' },
  'valençay': { r: 'Loire', c: 'blanc' },
  'chinon': { r: 'Loire', c: 'rouge' }, 'bourgueil': { r: 'Loire', c: 'rouge' },
  'saint-nicolas-de-bourgueil': { r: 'Loire', c: 'rouge' },
  'saumur-champigny': { r: 'Loire', c: 'rouge' }, 'saumur': { r: 'Loire', c: 'rouge' },
  'anjou': { r: 'Loire', c: 'rouge' },
  'quarts de chaume': { r: 'Loire', c: 'moelleux' }, 'bonnezeaux': { r: 'Loire', c: 'moelleux' },
  'coteaux du layon': { r: 'Loire', c: 'moelleux' }, 'crémant de loire': { r: 'Loire', c: 'effervescent' },
  // ── Alsace
  'riesling': { r: 'Alsace', c: 'blanc' }, 'gewurztraminer': { r: 'Alsace', c: 'blanc' },
  'pinot gris': { r: 'Alsace', c: 'blanc' }, 'sylvaner': { r: 'Alsace', c: 'blanc' },
  'pinot blanc': { r: 'Alsace', c: 'blanc' }, 'alsace': { r: 'Alsace', c: 'blanc' },
  'crémant d\'alsace': { r: 'Alsace', c: 'effervescent' },
  // ── Champagne & bulles
  'champagne': { r: 'Champagne', c: 'effervescent' }, 'crémant': { r: 'Loire', c: 'effervescent' },
  // ── Languedoc-Roussillon
  'pic saint-loup': { r: 'Languedoc', c: 'rouge' }, 'terrasses du larzac': { r: 'Languedoc', c: 'rouge' },
  'faugères': { r: 'Languedoc', c: 'rouge' }, 'saint-chinian': { r: 'Languedoc', c: 'rouge' },
  'minervois': { r: 'Languedoc', c: 'rouge' }, 'corbières': { r: 'Languedoc', c: 'rouge' },
  'fitou': { r: 'Languedoc', c: 'rouge' }, 'la clape': { r: 'Languedoc', c: 'rouge' },
  'collioure': { r: 'Languedoc', c: 'rouge' }, 'limoux': { r: 'Languedoc', c: 'blanc' },
  'picpoul de pinet': { r: 'Languedoc', c: 'blanc' },
  'blanquette de limoux': { r: 'Languedoc', c: 'effervescent' },
  'banyuls': { r: 'Languedoc', c: 'moelleux' }, 'maury': { r: 'Languedoc', c: 'moelleux' },
  'rivesaltes': { r: 'Languedoc', c: 'moelleux' },
  // ── Provence / Corse
  'bandol': { r: 'Provence', c: 'rouge' }, 'palette': { r: 'Provence', c: 'rouge' },
  'bellet': { r: 'Provence', c: 'rouge' }, 'cassis': { r: 'Provence', c: 'blanc' },
  'côtes de provence': { r: 'Provence', c: 'rosé' }, 'coteaux d\'aix': { r: 'Provence', c: 'rosé' },
  'coteaux varois': { r: 'Provence', c: 'rosé' },
  'patrimonio': { r: 'Corse', c: 'rouge' }, 'ajaccio': { r: 'Corse', c: 'rouge' },
  'figari': { r: 'Corse', c: 'rouge' }, 'sartène': { r: 'Corse', c: 'rouge' },
  'calvi': { r: 'Corse', c: 'rouge' }, 'vin de corse': { r: 'Corse', c: 'rouge' },
  // ── Sud-Ouest
  'cahors': { r: 'Sud-Ouest', c: 'rouge' }, 'madiran': { r: 'Sud-Ouest', c: 'rouge' },
  'bergerac': { r: 'Sud-Ouest', c: 'rouge' }, 'gaillac': { r: 'Sud-Ouest', c: 'rouge' },
  'fronton': { r: 'Sud-Ouest', c: 'rouge' }, 'marcillac': { r: 'Sud-Ouest', c: 'rouge' },
  'irouléguy': { r: 'Sud-Ouest', c: 'rouge' }, 'buzet': { r: 'Sud-Ouest', c: 'rouge' },
  'côtes de duras': { r: 'Sud-Ouest', c: 'rouge' },
  'jurançon': { r: 'Sud-Ouest', c: 'moelleux' }, 'monbazillac': { r: 'Sud-Ouest', c: 'moelleux' },
  'pacherenc': { r: 'Sud-Ouest', c: 'moelleux' },
  // ── Jura / Savoie
  'arbois': { r: 'Jura', c: 'blanc' }, 'château-chalon': { r: 'Jura', c: 'blanc' },
  'vin jaune': { r: 'Jura', c: 'blanc' }, 'côtes du jura': { r: 'Jura', c: 'blanc' },
  'l\'étoile': { r: 'Jura', c: 'blanc' }, 'macvin': { r: 'Jura', c: 'moelleux' },
  'crémant du jura': { r: 'Jura', c: 'effervescent' },
  'apremont': { r: 'Savoie', c: 'blanc' }, 'chignin': { r: 'Savoie', c: 'blanc' },
  'roussette de savoie': { r: 'Savoie', c: 'blanc' }, 'mondeuse': { r: 'Savoie', c: 'rouge' },
  // ── Vin de France
  'vin de france': { r: 'Vin de France', c: null },
  // ── Italie
  'barolo': { r: 'Piémont', c: 'rouge', p: 'Italie' }, 'barbaresco': { r: 'Piémont', c: 'rouge', p: 'Italie' },
  'barbera d\'alba': { r: 'Piémont', c: 'rouge', p: 'Italie' }, 'barbera d\'asti': { r: 'Piémont', c: 'rouge', p: 'Italie' },
  'dolcetto': { r: 'Piémont', c: 'rouge', p: 'Italie' }, 'gattinara': { r: 'Piémont', c: 'rouge', p: 'Italie' },
  'nebbiolo': { r: 'Piémont', c: 'rouge', p: 'Italie' }, 'roero': { r: 'Piémont', c: 'rouge', p: 'Italie' },
  'gavi': { r: 'Piémont', c: 'blanc', p: 'Italie' },
  'brunello': { r: 'Toscane', c: 'rouge', p: 'Italie' }, 'brunello di montalcino': { r: 'Toscane', c: 'rouge', p: 'Italie' },
  'chianti': { r: 'Toscane', c: 'rouge', p: 'Italie' }, 'chianti classico': { r: 'Toscane', c: 'rouge', p: 'Italie' },
  'bolgheri': { r: 'Toscane', c: 'rouge', p: 'Italie' }, 'vino nobile': { r: 'Toscane', c: 'rouge', p: 'Italie' },
  'morellino': { r: 'Toscane', c: 'rouge', p: 'Italie' },
  'amarone': { r: 'Vénétie', c: 'rouge', p: 'Italie' }, 'valpolicella': { r: 'Vénétie', c: 'rouge', p: 'Italie' },
  'ripasso': { r: 'Vénétie', c: 'rouge', p: 'Italie' }, 'bardolino': { r: 'Vénétie', c: 'rouge', p: 'Italie' },
  'soave': { r: 'Vénétie', c: 'blanc', p: 'Italie' }, 'prosecco': { r: 'Vénétie', c: 'effervescent', p: 'Italie' },
  'etna': { r: 'Sicile', c: 'rouge', p: 'Italie' }, 'nero d\'avola': { r: 'Sicile', c: 'rouge', p: 'Italie' },
  'marsala': { r: 'Sicile', c: 'moelleux', p: 'Italie' },
  'montepulciano d\'abruzzo': { r: 'Abruzzes', c: 'rouge', p: 'Italie' },
  'primitivo': { r: 'Pouilles', c: 'rouge', p: 'Italie' }, 'salice salentino': { r: 'Pouilles', c: 'rouge', p: 'Italie' },
  'taurasi': { r: 'Campanie', c: 'rouge', p: 'Italie' }, 'greco di tufo': { r: 'Campanie', c: 'blanc', p: 'Italie' },
  'fiano': { r: 'Campanie', c: 'blanc', p: 'Italie' },
  'franciacorta': { r: 'Lombardie', c: 'effervescent', p: 'Italie' },
  'lambrusco': { r: 'Lombardie', c: 'effervescent', p: 'Italie' },
  'verdicchio': { r: 'Italie', c: 'blanc', p: 'Italie' },
  // ── Espagne
  'rioja': { r: 'Rioja', c: 'rouge', p: 'Espagne' },
  'ribera del duero': { r: 'Ribera del Duero', c: 'rouge', p: 'Espagne' },
  'priorat': { r: 'Priorat', c: 'rouge', p: 'Espagne' },
  'montsant': { r: 'Catalogne', c: 'rouge', p: 'Espagne' },
  'penedès': { r: 'Catalogne', c: 'rouge', p: 'Espagne' },
  'cava': { r: 'Catalogne', c: 'effervescent', p: 'Espagne' },
  'toro': { r: 'Castille', c: 'rouge', p: 'Espagne' },
  'rueda': { r: 'Castille', c: 'blanc', p: 'Espagne' },
  'bierzo': { r: 'Castille', c: 'rouge', p: 'Espagne' },
  'rías baixas': { r: 'Galice', c: 'blanc', p: 'Espagne' },
  'albariño': { r: 'Galice', c: 'blanc', p: 'Espagne' },
  'jumilla': { r: 'Espagne', c: 'rouge', p: 'Espagne' },
  'navarra': { r: 'Espagne', c: 'rouge', p: 'Espagne' },
  'somontano': { r: 'Espagne', c: 'rouge', p: 'Espagne' },
  'jerez': { r: 'Andalousie', c: 'blanc', p: 'Espagne' }, 'xérès': { r: 'Andalousie', c: 'blanc', p: 'Espagne' },
  // ── Argentine
  'mendoza': { r: 'Mendoza', c: 'rouge', p: 'Argentine' },
  'luján de cuyo': { r: 'Mendoza', c: 'rouge', p: 'Argentine' },
  'valle de uco': { r: 'Mendoza', c: 'rouge', p: 'Argentine' },
  'cafayate': { r: 'Salta', c: 'rouge', p: 'Argentine' },
  'salta': { r: 'Salta', c: 'rouge', p: 'Argentine' },
  'río negro': { r: 'Patagonie', c: 'rouge', p: 'Argentine' },
  // ── Chili
  'maipo': { r: 'Vallée de Maipo', c: 'rouge', p: 'Chili' },
  'colchagua': { r: 'Colchagua', c: 'rouge', p: 'Chili' },
  'casablanca': { r: 'Casablanca', c: 'blanc', p: 'Chili' },
  'aconcagua': { r: 'Vallée de Maipo', c: 'rouge', p: 'Chili' },
  'maule': { r: 'Colchagua', c: 'rouge', p: 'Chili' },
  'itata': { r: 'Colchagua', c: 'rouge', p: 'Chili' },
  'limarí': { r: 'Casablanca', c: 'blanc', p: 'Chili' },
  'leyda': { r: 'Casablanca', c: 'blanc', p: 'Chili' },
  // ── Géorgie
  'kakhétie': { r: 'Kakhétie', c: 'rouge', p: 'Géorgie' }, 'kakheti': { r: 'Kakhétie', c: 'rouge', p: 'Géorgie' },
  'mukuzani': { r: 'Kakhétie', c: 'rouge', p: 'Géorgie' },
  'kindzmarauli': { r: 'Kakhétie', c: 'rouge', p: 'Géorgie' },
  'khvanchkara': { r: 'Kakhétie', c: 'rouge', p: 'Géorgie' },
  'tsinandali': { r: 'Kakhétie', c: 'blanc', p: 'Géorgie' },
  'saperavi': { r: 'Kakhétie', c: 'rouge', p: 'Géorgie' },
  'rkatsiteli': { r: 'Kakhétie', c: 'blanc', p: 'Géorgie' },
  'kartli': { r: 'Karthlie', c: 'blanc', p: 'Géorgie' },
  'imereti': { r: 'Iméréthie', c: 'blanc', p: 'Géorgie' },
  // ── Allemagne
  'mosel': { r: 'Moselle', c: 'blanc', p: 'Allemagne' }, 'moselle': { r: 'Moselle', c: 'blanc', p: 'Allemagne' },
  'rheingau': { r: 'Rheingau', c: 'blanc', p: 'Allemagne' },
  'pfalz': { r: 'Palatinat', c: 'blanc', p: 'Allemagne' }, 'palatinat': { r: 'Palatinat', c: 'blanc', p: 'Allemagne' },
  'rheinhessen': { r: 'Rheinhessen', c: 'blanc', p: 'Allemagne' },
  'nahe': { r: 'Rheinhessen', c: 'blanc', p: 'Allemagne' },
  'baden': { r: 'Bade', c: 'rouge', p: 'Allemagne' },
  'franken': { r: 'Franconie', c: 'blanc', p: 'Allemagne' },
  'spätlese': { r: 'Moselle', c: 'blanc', p: 'Allemagne' }, 'kabinett': { r: 'Moselle', c: 'blanc', p: 'Allemagne' },
  'trockenbeerenauslese': { r: 'Moselle', c: 'moelleux', p: 'Allemagne' },
  // ── Grèce
  'santorin': { r: 'Santorin', c: 'blanc', p: 'Grèce' }, 'santorini': { r: 'Santorin', c: 'blanc', p: 'Grèce' },
  'assyrtiko': { r: 'Santorin', c: 'blanc', p: 'Grèce' },
  'naoussa': { r: 'Naoussa', c: 'rouge', p: 'Grèce' }, 'xinomavro': { r: 'Naoussa', c: 'rouge', p: 'Grèce' },
  'némée': { r: 'Némée', c: 'rouge', p: 'Grèce' }, 'nemea': { r: 'Némée', c: 'rouge', p: 'Grèce' },
  'agiorgitiko': { r: 'Némée', c: 'rouge', p: 'Grèce' },
  'mantinée': { r: 'Mantinée', c: 'blanc', p: 'Grèce' }, 'moschofilero': { r: 'Mantinée', c: 'blanc', p: 'Grèce' },
  'rapsani': { r: 'Naoussa', c: 'rouge', p: 'Grèce' },
  'vinsanto': { r: 'Santorin', c: 'moelleux', p: 'Grèce' },
  // ── Portugal / USA
  'douro': { r: 'Douro', c: 'rouge', p: 'Portugal' }, 'porto': { r: 'Douro', c: 'moelleux', p: 'Portugal' },
  'vinho verde': { r: 'Vinho Verde', c: 'blanc', p: 'Portugal' },
  'alentejo': { r: 'Alentejo', c: 'rouge', p: 'Portugal' },
  'napa': { r: 'Napa Valley', c: 'rouge', p: 'États-Unis' },
  'sonoma': { r: 'Sonoma', c: 'rouge', p: 'États-Unis' },
  'willamette': { r: 'Oregon', c: 'rouge', p: 'États-Unis' },
};

export function gardeParDefaut(region, couleur, millesime) {
  const g = (GARDE[region] && GARDE[region][couleur]) || DEFAUT_GARDE[couleur] || [2, 8];
  const m = millesime || new Date().getFullYear();
  return { gardeDe: m + g[0], gardeA: m + g[1] };
}

// Statut de maturité d'une bouteille pour une année donnée.
// → { code: 'jeune'|'approche'|'apogee'|'urgent'|'passe', label, ordre }
export function maturite(bottle, annee) {
  const y = annee ?? new Date().getFullYear();
  if (!bottle.millesime || !bottle.gardeDe || !bottle.gardeA) {
    return { code: 'apogee', label: 'À boire', ordre: 1 };
  }
  if (y < bottle.gardeDe - 1) return { code: 'jeune', label: 'À attendre', ordre: 3 };
  if (y < bottle.gardeDe) return { code: 'approche', label: 'Approche', ordre: 2 };
  if (y > bottle.gardeA) return { code: 'passe', label: 'Sur le déclin', ordre: 4 };
  const restant = bottle.gardeA - y;
  if (restant <= 1) return { code: 'urgent', label: 'À boire vite', ordre: 0 };
  return { code: 'apogee', label: 'Apogée', ordre: 1 };
}
