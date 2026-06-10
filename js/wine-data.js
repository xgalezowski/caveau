// Référentiel œnologique : régions, fenêtres de garde, appellations, profils d'accords.
// Module pur (aucune dépendance DOM) — importable côté navigateur et Node (tests).

export const COULEURS = ['rouge', 'blanc', 'rosé', 'effervescent', 'moelleux'];

// Fenêtres de garde par défaut (années après le millésime) : [début apogée, fin apogée]
export const GARDE = {
  'Bordeaux':        { rouge: [5, 20], blanc: [2, 8],  moelleux: [5, 30], 'rosé': [1, 3] },
  'Bourgogne':       { rouge: [4, 15], blanc: [3, 10] },
  'Rhône Nord':      { rouge: [5, 18], blanc: [2, 8] },
  'Rhône Sud':       { rouge: [3, 12], blanc: [1, 5],  'rosé': [1, 2] },
  'Loire':           { rouge: [3, 10], blanc: [2, 8],  moelleux: [5, 40], effervescent: [1, 4] },
  'Alsace':          { blanc: [2, 10], moelleux: [5, 25] },
  'Champagne':       { effervescent: [2, 10] },
  'Beaujolais':      { rouge: [1, 5] },
  'Languedoc':       { rouge: [2, 8],  blanc: [1, 4],  'rosé': [1, 2] },
  'Provence':        { 'rosé': [0, 2], rouge: [3, 10], blanc: [1, 4] },
  'Sud-Ouest':       { rouge: [3, 12], blanc: [1, 5],  moelleux: [4, 25] },
  'Jura':            { blanc: [3, 20], rouge: [2, 8] },
  'Savoie':          { blanc: [1, 4],  rouge: [1, 4] },
  'Corse':           { rouge: [2, 8],  blanc: [1, 4],  'rosé': [1, 2] },
  'Italie':          { rouge: [4, 15], blanc: [1, 5],  effervescent: [1, 3] },
  'Espagne':         { rouge: [4, 15], blanc: [1, 5] },
  'Monde':           { rouge: [3, 12], blanc: [1, 6],  'rosé': [1, 2], effervescent: [1, 5], moelleux: [3, 15] },
};
export const REGIONS = Object.keys(GARDE);
const DEFAUT_GARDE = { rouge: [3, 10], blanc: [1, 5], 'rosé': [1, 2], effervescent: [1, 5], moelleux: [3, 15] };

// Corps du vin par région/couleur : 1 léger · 2 moyen · 3 puissant
export const CORPS = {
  'Bordeaux|rouge': 3, 'Bourgogne|rouge': 2, 'Rhône Nord|rouge': 3, 'Rhône Sud|rouge': 3,
  'Loire|rouge': 1, 'Beaujolais|rouge': 1, 'Languedoc|rouge': 3, 'Sud-Ouest|rouge': 3,
  'Italie|rouge': 3, 'Espagne|rouge': 3, 'Provence|rouge': 2, 'Corse|rouge': 2, 'Jura|rouge': 1,
  'Bourgogne|blanc': 2, 'Bordeaux|blanc': 2, 'Loire|blanc': 1, 'Alsace|blanc': 2,
  'Rhône Nord|blanc': 3, 'Rhône Sud|blanc': 2, 'Jura|blanc': 3, 'Savoie|blanc': 1,
};
export function corpsDe(region, couleur) {
  return CORPS[`${region}|${couleur}`] ?? 2;
}

// Appellations connues → { r: région, c: couleur dominante }
// Sert au parsing texte/dictée et aux suggestions d'équivalents.
export const APPELLATIONS = {
  // Bordeaux
  'margaux': { r: 'Bordeaux', c: 'rouge' }, 'pauillac': { r: 'Bordeaux', c: 'rouge' },
  'saint-julien': { r: 'Bordeaux', c: 'rouge' }, 'saint-estèphe': { r: 'Bordeaux', c: 'rouge' },
  'pessac-léognan': { r: 'Bordeaux', c: 'rouge' }, 'graves': { r: 'Bordeaux', c: 'rouge' },
  'saint-émilion': { r: 'Bordeaux', c: 'rouge' }, 'pomerol': { r: 'Bordeaux', c: 'rouge' },
  'fronsac': { r: 'Bordeaux', c: 'rouge' }, 'médoc': { r: 'Bordeaux', c: 'rouge' },
  'haut-médoc': { r: 'Bordeaux', c: 'rouge' }, 'castillon': { r: 'Bordeaux', c: 'rouge' },
  'sauternes': { r: 'Bordeaux', c: 'moelleux' }, 'barsac': { r: 'Bordeaux', c: 'moelleux' },
  'entre-deux-mers': { r: 'Bordeaux', c: 'blanc' },
  // Bourgogne
  'chablis': { r: 'Bourgogne', c: 'blanc' }, 'meursault': { r: 'Bourgogne', c: 'blanc' },
  'puligny-montrachet': { r: 'Bourgogne', c: 'blanc' }, 'chassagne-montrachet': { r: 'Bourgogne', c: 'blanc' },
  'montrachet': { r: 'Bourgogne', c: 'blanc' }, 'corton-charlemagne': { r: 'Bourgogne', c: 'blanc' },
  'pouilly-fuissé': { r: 'Bourgogne', c: 'blanc' }, 'mâcon': { r: 'Bourgogne', c: 'blanc' },
  'saint-véran': { r: 'Bourgogne', c: 'blanc' }, 'rully': { r: 'Bourgogne', c: 'blanc' },
  'gevrey-chambertin': { r: 'Bourgogne', c: 'rouge' }, 'chambolle-musigny': { r: 'Bourgogne', c: 'rouge' },
  'vosne-romanée': { r: 'Bourgogne', c: 'rouge' }, 'nuits-saint-georges': { r: 'Bourgogne', c: 'rouge' },
  'pommard': { r: 'Bourgogne', c: 'rouge' }, 'volnay': { r: 'Bourgogne', c: 'rouge' },
  'beaune': { r: 'Bourgogne', c: 'rouge' }, 'savigny': { r: 'Bourgogne', c: 'rouge' },
  'mercurey': { r: 'Bourgogne', c: 'rouge' }, 'givry': { r: 'Bourgogne', c: 'rouge' },
  'corton': { r: 'Bourgogne', c: 'rouge' }, 'clos de vougeot': { r: 'Bourgogne', c: 'rouge' },
  'morey-saint-denis': { r: 'Bourgogne', c: 'rouge' }, 'marsannay': { r: 'Bourgogne', c: 'rouge' },
  'irancy': { r: 'Bourgogne', c: 'rouge' },
  // Beaujolais
  'morgon': { r: 'Beaujolais', c: 'rouge' }, 'fleurie': { r: 'Beaujolais', c: 'rouge' },
  'moulin-à-vent': { r: 'Beaujolais', c: 'rouge' }, 'brouilly': { r: 'Beaujolais', c: 'rouge' },
  'juliénas': { r: 'Beaujolais', c: 'rouge' }, 'chiroubles': { r: 'Beaujolais', c: 'rouge' },
  'saint-amour': { r: 'Beaujolais', c: 'rouge' }, 'beaujolais': { r: 'Beaujolais', c: 'rouge' },
  // Rhône
  'côte-rôtie': { r: 'Rhône Nord', c: 'rouge' }, 'hermitage': { r: 'Rhône Nord', c: 'rouge' },
  'crozes-hermitage': { r: 'Rhône Nord', c: 'rouge' }, 'cornas': { r: 'Rhône Nord', c: 'rouge' },
  'saint-joseph': { r: 'Rhône Nord', c: 'rouge' }, 'condrieu': { r: 'Rhône Nord', c: 'blanc' },
  'châteauneuf-du-pape': { r: 'Rhône Sud', c: 'rouge' }, 'gigondas': { r: 'Rhône Sud', c: 'rouge' },
  'vacqueyras': { r: 'Rhône Sud', c: 'rouge' }, 'rasteau': { r: 'Rhône Sud', c: 'rouge' },
  'cairanne': { r: 'Rhône Sud', c: 'rouge' }, 'lirac': { r: 'Rhône Sud', c: 'rouge' },
  'tavel': { r: 'Rhône Sud', c: 'rosé' }, 'côtes-du-rhône': { r: 'Rhône Sud', c: 'rouge' },
  'ventoux': { r: 'Rhône Sud', c: 'rouge' },
  // Loire
  'sancerre': { r: 'Loire', c: 'blanc' }, 'pouilly-fumé': { r: 'Loire', c: 'blanc' },
  'vouvray': { r: 'Loire', c: 'blanc' }, 'savennières': { r: 'Loire', c: 'blanc' },
  'muscadet': { r: 'Loire', c: 'blanc' }, 'montlouis': { r: 'Loire', c: 'blanc' },
  'chinon': { r: 'Loire', c: 'rouge' }, 'bourgueil': { r: 'Loire', c: 'rouge' },
  'saumur-champigny': { r: 'Loire', c: 'rouge' }, 'anjou': { r: 'Loire', c: 'rouge' },
  'quarts de chaume': { r: 'Loire', c: 'moelleux' }, 'coteaux du layon': { r: 'Loire', c: 'moelleux' },
  // Alsace
  'riesling': { r: 'Alsace', c: 'blanc' }, 'gewurztraminer': { r: 'Alsace', c: 'blanc' },
  'pinot gris': { r: 'Alsace', c: 'blanc' }, 'alsace': { r: 'Alsace', c: 'blanc' },
  // Champagne
  'champagne': { r: 'Champagne', c: 'effervescent' }, 'crémant': { r: 'Loire', c: 'effervescent' },
  // Languedoc / Provence / Sud-Ouest / Corse
  'pic saint-loup': { r: 'Languedoc', c: 'rouge' }, 'terrasses du larzac': { r: 'Languedoc', c: 'rouge' },
  'faugères': { r: 'Languedoc', c: 'rouge' }, 'minervois': { r: 'Languedoc', c: 'rouge' },
  'corbières': { r: 'Languedoc', c: 'rouge' }, 'fitou': { r: 'Languedoc', c: 'rouge' },
  'bandol': { r: 'Provence', c: 'rouge' }, 'cassis': { r: 'Provence', c: 'blanc' },
  'côtes de provence': { r: 'Provence', c: 'rosé' }, 'palette': { r: 'Provence', c: 'rouge' },
  'cahors': { r: 'Sud-Ouest', c: 'rouge' }, 'madiran': { r: 'Sud-Ouest', c: 'rouge' },
  'bergerac': { r: 'Sud-Ouest', c: 'rouge' }, 'gaillac': { r: 'Sud-Ouest', c: 'rouge' },
  'jurançon': { r: 'Sud-Ouest', c: 'moelleux' }, 'monbazillac': { r: 'Sud-Ouest', c: 'moelleux' },
  'patrimonio': { r: 'Corse', c: 'rouge' }, 'ajaccio': { r: 'Corse', c: 'rouge' },
  // Jura / Savoie
  'arbois': { r: 'Jura', c: 'blanc' }, 'château-chalon': { r: 'Jura', c: 'blanc' },
  'vin jaune': { r: 'Jura', c: 'blanc' }, 'apremont': { r: 'Savoie', c: 'blanc' },
  'chignin': { r: 'Savoie', c: 'blanc' },
  // Italie / Espagne / Monde
  'barolo': { r: 'Italie', c: 'rouge' }, 'barbaresco': { r: 'Italie', c: 'rouge' },
  'brunello': { r: 'Italie', c: 'rouge' }, 'chianti': { r: 'Italie', c: 'rouge' },
  'amarone': { r: 'Italie', c: 'rouge' }, 'prosecco': { r: 'Italie', c: 'effervescent' },
  'rioja': { r: 'Espagne', c: 'rouge' }, 'ribera del duero': { r: 'Espagne', c: 'rouge' },
  'priorat': { r: 'Espagne', c: 'rouge' },
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
