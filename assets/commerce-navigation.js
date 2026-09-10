'use strict';

(function () {
  const language = document.querySelector('[data-commerce-language]');
  const contents = document.querySelector('[data-policy-contents]');
  const links = [...document.querySelectorAll('.policy-toc a[href^="#"]')];
  const mobile = window.matchMedia('(max-width: 700px)');
  function updateLocation() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
    const section = id ? document.getElementById(id) : null;
    const valid = section?.classList.contains('policy-section');
    if (language) {
      const target = new URL(language.getAttribute('href'), location.href);
      target.hash = valid ? id : '';
      language.href = target.href;
    }
    for (const link of links) {
      if (valid && link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  if (contents) {
    const resizeContents = () => { contents.open = !mobile.matches; };
    resizeContents();
    mobile.addEventListener('change', resizeContents);
    for (const link of links) link.addEventListener('click', () => {
      if (mobile.matches) contents.open = false;
    });
  }
  window.addEventListener('hashchange', updateLocation);
  updateLocation();
})();
