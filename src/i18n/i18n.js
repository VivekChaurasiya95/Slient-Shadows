'use strict';
// ==========================================================================
// I18N: English (default) and Hindi in conversational Hinglish.
// Keys are the English source strings (gettext style), so English needs no
// table and a missing translation falls back to English instead of breaking.
//   T('Take {item}', { item: T('Crowbar') })
// Spoken lines can also carry a Devanagari copy for hi-IN speech voices.
// The choice is saved in localStorage and applied live (no restart).
// ==========================================================================
const I18N = {
  KEY: 'silentshadows.lang.v1',
  LANGS: ['en', 'hi'],
  lang: 'en',
  tables: { en: {}, hi: {} },
  speech: { en: {}, hi: {} },
  listeners: [],

  register(lang, table, speech) {
    this.tables[lang] = Object.assign(this.tables[lang] || {}, table || {});
    this.speech[lang] = Object.assign(this.speech[lang] || {}, speech || {});
  },
  load() {
    try { const v = localStorage.getItem(this.KEY); if (this.LANGS.includes(v)) this.lang = v; } catch (e) { /* storage blocked */ }
    this.syncDocLang();
    return this.lang;
  },
  set(lang) {
    if (!this.LANGS.includes(lang) || lang === this.lang) return false;
    this.lang = lang;
    try { localStorage.setItem(this.KEY, lang); } catch (e) { /* storage blocked */ }
    this.syncDocLang();
    this.applyDom();
    this.listeners.slice().forEach(fn => { try { fn(lang); } catch (err) { console.error('[i18n listener]', err); } });
    return true;
  },
  onChange(fn) { this.listeners.push(fn); },
  syncDocLang() { if (typeof document !== 'undefined') document.documentElement.lang = this.lang === 'hi' ? 'hi-Latn' : 'en'; },

  // ---- lookup -------------------------------------------------------------------
  norm(s) { return String(s).replace(/\s+/g, ' ').trim(); },
  has(s, lang) { const t = this.tables[lang || this.lang]; return !!(t && Object.prototype.hasOwnProperty.call(t, s)); },
  raw(s) {
    if (s === null || s === undefined) return s;
    if (this.lang === 'en') return s;
    const t = this.tables[this.lang];
    if (t && Object.prototype.hasOwnProperty.call(t, s)) return t[s];
    return s;
  },
  t(s, params) {
    let out = this.raw(s);
    if (typeof out !== 'string') return out;
    if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : String(params[k])));
    return out;
  },
  // Text handed to the speech engine. Hindi lines have a Devanagari copy for hi-IN voices.
  speechText(englishSource, displayed, devanagari) {
    if (this.lang === 'hi' && devanagari) { const s = this.speech.hi[englishSource]; if (s) return s; }
    return displayed;
  },

  // ---- static DOM -------------------------------------------------------------------
  // data-i18n: text content. data-i18n-html: inner HTML (keeps <kbd> markup).
  // data-i18n-ph / -title / -aria: the attribute value is the key.
  applyDom(root) {
    if (typeof document === 'undefined') return;
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.dataset.i18nSrc === undefined) el.dataset.i18nSrc = this.norm(el.textContent);
      const v = this.t(el.dataset.i18nSrc); if (el.textContent !== v) el.textContent = v;
    });
    r.querySelectorAll('[data-i18n-html]').forEach(el => {
      if (el.dataset.i18nSrc === undefined) el.dataset.i18nSrc = this.norm(el.innerHTML);
      const v = this.t(el.dataset.i18nSrc); if (el.innerHTML !== v) el.innerHTML = v;
    });
    [['data-i18n-ph', 'placeholder'], ['data-i18n-title', 'title'], ['data-i18n-aria', 'aria-label']].forEach(([a, target]) => {
      r.querySelectorAll('[' + a + ']').forEach(el => el.setAttribute(target, this.t(el.getAttribute(a))));
    });
    // language pickers show the active choice
    r.querySelectorAll('.seg-lang button').forEach(b => { const on = b.dataset.lang === this.lang; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  },
  // Every .seg-lang group (menu, options, pause) switches the language
  bindPickers(root) {
    if (typeof document === 'undefined') return;
    (root || document).querySelectorAll('.seg-lang button').forEach(b => {
      if (b.dataset.bound) return; b.dataset.bound = '1';
      b.addEventListener('click', e => { e.stopPropagation(); this.set(b.dataset.lang); });
    });
    this.applyDom(root);
  }
};

function T(s, params) { return I18N.t(s, params); }
// English sentences lower-case item names in the middle of a line ("Take crowbar"). Hinglish keeps them as written.
function lc(s) { return I18N.lang === 'en' ? String(s).toLowerCase() : s; }

if (typeof module !== 'undefined') module.exports = { I18N, T, lc };
