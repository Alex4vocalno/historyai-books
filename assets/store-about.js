'use strict';
/* global document, window, localStorage, location */

(function () {
  const root = document.getElementById('evoron-about');
  if (!root) return;
  try { localStorage.setItem('hai.shelfLang', document.documentElement.lang.startsWith('en') ? 'en' : 'zh'); } catch { /* Reading does not require browser storage. */ }
  const language = root.querySelector('.ev-language');
  const contents = [...root.querySelectorAll('.ev-contents a')];
  function updateLocation() {
    const current = contents.find(link => link.hash === location.hash);
    const target = new URL(language.href);
    target.hash = current ? current.hash : '';
    language.href = target.href;
    contents.forEach(link => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', updateLocation);
  updateLocation();
})();
