import { store } from './store.js';

// Import locales
import fr from './locales/fr.js';
import en from './locales/en.js';
import es from './locales/es.js';

import promptsFr from './locales/prompts-fr.js';
import promptsEn from './locales/prompts-en.js';
import promptsEs from './locales/prompts-es.js';

const DICTIONARIES = {
  fr: { ui: fr, prompts: promptsFr },
  en: { ui: en, prompts: promptsEn },
  es: { ui: es, prompts: promptsEs }
};

const DEFAULT_LANG = 'fr';

/**
 * Gets the current active language from the store.
 * Fallbacks to 'fr' if not set.
 */
export function getLang() {
  const state = store.get();
  return state.settings?.lang || DEFAULT_LANG;
}

/**
 * Translates a UI key based on the current language.
 * Supports simple interpolation via {variable}.
 * @param {string} key - The dictionary key (e.g., 'cave.vide')
 * @param {Object} [vars] - Variables for interpolation (e.g., { n: 3 })
 * @returns {string} The translated string
 */
export function t(key, vars = {}) {
  const lang = getLang();
  const dict = DICTIONARIES[lang]?.ui || DICTIONARIES[DEFAULT_LANG].ui;
  
  let text = dict[key];
  if (text === undefined) {
    console.warn(`[i18n] Missing translation for key: ${key}`);
    return key;
  }
  
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  
  return text;
}

/**
 * Gets a prompt template or string based on the current language.
 * @param {string} key - The prompt key (e.g., 'systemEtiquette')
 * @returns {string|Function} The prompt text or function
 */
export function getPrompt(key) {
  const lang = getLang();
  const dict = DICTIONARIES[lang]?.prompts || DICTIONARIES[DEFAULT_LANG].prompts;
  
  return dict[key];
}

/**
 * Convenience method to translate multiple voice lines and pick one randomly.
 * @param {string} prefix - The prefix of the keys (e.g., 'voix.ajoutLot')
 * @param {number} max - The number of variants (exclusive of max)
 * @param {Object} [vars] - Variables for interpolation
 * @returns {string} A randomly selected translated phrase
 */
export function tAleatoire(prefix, max, vars = {}) {
  const idx = Math.floor(Math.random() * max);
  return t(`${prefix}.${idx}`, vars);
}

/**
 * Translates the current DOM based on data-i18n and data-i18n-placeholder attributes.
 */
export function traduireDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}
