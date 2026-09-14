'use strict';

(function () {
  const key = 'evoron.staticLanguageScroll';
  function apply(state) {
    if (!state.loaded) return;
    const pageEnglish = document.documentElement.lang.startsWith('en');
    if (pageEnglish === (state.language === 'en')) return;
    const target = new URL(location.href);
    target.pathname = target.pathname.replace(/(?:-en)?\.html$/, (state.language === 'en' ? '-en' : '') + '.html');
    if (target.href === location.href) return;
    try { sessionStorage.setItem(key, JSON.stringify({ href: target.href, y: window.scrollY })); } catch { /* Optional scroll restoration. */ }
    location.replace(target.href);
  }
  function restore() {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (value?.href !== location.href) return;
      sessionStorage.removeItem(key);
      window.scrollTo(0, value.y);
    } catch { /* The document remains readable without browser storage. */ }
  }
  window.addEventListener('evoron:language', event => apply(event.detail));
  window.addEventListener('load', restore, { once: true });
  apply(window.EvoronLanguage.state());
})();
