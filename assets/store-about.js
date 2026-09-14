'use strict';
/* global document, window, location */

(function () {
  const root = document.getElementById('evoron-about');
  if (!root) return;
  const contents = [...root.querySelectorAll('.ev-contents a')];
  function updateLocation() {
    const current = contents.find(link => link.hash === location.hash);
    contents.forEach(link => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', updateLocation);
  updateLocation();
})();
