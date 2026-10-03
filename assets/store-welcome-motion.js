/* global document, window */
(function () {
  'use strict';
  window.EvoronWelcomeMotion = function (dialog, english) {
    const field = document.createElement('div');
    field.className = 'welcome-book-field';
    field.setAttribute('aria-hidden', 'true');
    const title = dialog.querySelector('h2');
    const controls = document.createElement('div');
    controls.className = 'welcome-motion-controls';
    controls.innerHTML = '<button type="button" data-motion-pause></button><button type="button" data-motion-skip></button>';
    dialog.append(field, controls);
    const pause = controls.firstElementChild, skip = controls.lastElementChild;
    skip.textContent = english ? 'Skip intro' : '跳过开场';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animations = [], frame = 0, elapsed = 0, last = 0, paused = false, active = -1, titleMotion;
    let pool = [];
    try { pool = JSON.parse(document.getElementById('evoron-store-pool')?.textContent || '[]'); } catch { /* Reading remains available without catalog artwork. */ }
    const covers = [...new Set(pool.filter(book => book.lang === (english ? 'en' : 'zh') && !book.x).map(book => book.c))]
      .filter(src => {
        try { const url = new URL(src, window.location.href); return src && url.origin === window.location.origin && /\.(jpe?g|png|webp)$/i.test(url.pathname); } catch { return false; }
      }).slice(0, 12);
    const duration = 10000;
    const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * x * (x * (x * 6 - 15) + 10); };
    const books = [];
    for (let i = 0; i < (covers.length ? 32 : 0); i++) {
      const img = document.createElement('img');
      img.className = 'welcome-flying-book';
      img.onload = () => { img.classList.add('is-loaded'); };
      img.onerror = () => { img.hidden = true; };
      img.src = covers[i % covers.length]; img.alt = ''; img.decoding = 'async';
      field.append(img); books.push(img);
    }
    function build() {
      animations.forEach(animation => animation.cancel()); animations = [];
      const width = dialog.clientWidth, height = dialog.clientHeight, mobile = width < 650;
      books.forEach((book, i) => {
        const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
        const y = (row / 15) * height;
        const keys = [];
        for (let time = 0; time <= duration; time += 100) {
          const arrival = smooth((time - (i % 5) * 60) / 2100);
          const expansion = smooth((time - 2300 - (i % 7) * 35) / 3400);
          const settle = smooth((time - 6200) / 3400);
          const breadth = mobile ? 35 : 100 + (row % 3) * 65;
          const inset = breadth * (.5 + expansion * .5 - settle * .3);
          let x = side < 0 ? inset : width - inset;
          if (mobile && y > height * .19 && y < height * .8) x = side < 0 ? -30 : width + 30;
          x += side * (1 - arrival) * 180;
          const scale = (mobile ? .53 : .85) + (row % 3) * .08;
          const angle = side * (12 + (row % 4) * 5 - settle * 8);
          keys.push({ offset: time / duration,
            transform: 'translate(' + x + 'px,' + (y + 70 * (1 - arrival) - Math.sin(expansion * Math.PI) * 45) + 'px) translate(-50%,-50%) rotate(' + angle + 'deg) scale(' + scale + ')',
            opacity: arrival * (i < 8 ? 1 : expansion) * (row % 2 ? 1 - settle : 1),
          });
        }
        const animation = book.animate(keys, { duration, fill: 'both' });
        animation.pause(); animation.currentTime = elapsed; animations.push(animation);
      });
    }
    function render() {
      const next = elapsed < 2700 ? 0 : elapsed < 6500 ? 1 : 2;
      if (active !== next) {
        active = next;
        title.textContent = (english
          ? ['A thousand worlds.\nOne open page.', 'Not every book\nexists. Yet.', 'Read what you love.\nCreate what is missing.']
          : ['万千世界，\n一页翻开。', '不止于\n已有的书。', '读你所爱。\n创造你未曾读到的。'])[next];
        dialog.dataset.motionScene = String(next);
        if (!reduced.matches && typeof title.animate === 'function') {
          titleMotion?.cancel();
          titleMotion = title.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 450, easing: 'ease-out' });
        }
      }
      const label = paused ? (english ? 'Resume' : '继续') : (english ? 'Pause' : '暂停');
      pause.textContent = paused ? '▷' : 'Ⅱ'; pause.title = label; pause.setAttribute('aria-label', label);
      pause.setAttribute('aria-pressed', String(paused));
      controls.hidden = elapsed >= duration;
    }
    function tick(now) {
      if (last && !paused && !document.hidden) elapsed = Math.min(duration, elapsed + now - last);
      last = now;
      animations.forEach(animation => { animation.currentTime = elapsed; });
      render();
      if (elapsed < duration) frame = window.requestAnimationFrame(tick);
    }
    function finish() { elapsed = duration; animations.forEach(a => { a.currentTime = duration; }); render(); }
    pause.onclick = () => { paused = !paused; render(); };
    skip.onclick = () => { finish(); dialog.querySelector('[data-visit-read]').focus(); };
    function visibility() { last = 0; }
    function resize() { if (typeof field.animate === 'function') build(); }
    function preference() { if (reduced.matches) finish(); }
    // Do not wait for image downloads before allowing the visitor to read or dismiss.
    if (typeof field.animate === 'function') build();
    if (reduced.matches || typeof field.animate !== 'function' || !covers.length) finish();
    else { render(); frame = window.requestAnimationFrame(tick); }
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize);
    reduced.addEventListener('change', preference);
    return () => {
      window.cancelAnimationFrame(frame); animations.forEach(a => a.cancel());
      titleMotion?.cancel();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', preference);
      field.remove(); controls.remove();
    };
  };
}());
