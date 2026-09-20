/* global window */
'use strict';

(function () {
  const doc = window.document;
  const coverLink = doc.querySelector('[data-cover-zoom]');
  const T = (zh, en) => (window.EvoronLanguage?.state().language || doc.documentElement.lang).startsWith('en') ? en : zh;
  if (coverLink) {
    const thumbnail = coverLink.querySelector('img');
    const notice = doc.createElement('p');
    notice.className = 'cover-notice'; notice.setAttribute('role', 'status');
    const retry = doc.createElement('button');
    retry.type = 'button'; retry.dataset.coverRetry = ''; retry.className = 'cover-retry';
    retry.textContent = T('重试封面', 'Retry cover'); retry.hidden = true;
    coverLink.after(notice, retry);
    function thumbnailState(failed) {
      coverLink.classList.toggle('cover-failed', failed);
      notice.textContent = failed ? T('封面暂时未能加载', 'Cover unavailable') : '';
      retry.hidden = !failed; retry.disabled = false;
    }
    if (thumbnail) {
      thumbnail.addEventListener('error', () => thumbnailState(true));
      thumbnail.addEventListener('load', () => thumbnailState(false));
      if (thumbnail.complete) thumbnailState(!thumbnail.naturalWidth);
      retry.addEventListener('click', () => {
        retry.disabled = true; notice.textContent = T('正在加载封面…', 'Loading cover…');
        thumbnail.src = coverLink.href;
      });
    }
    coverLink.addEventListener('click', event => {
      if (typeof doc.createElement('dialog').showModal !== 'function') return;
      event.preventDefault();
      const dialog = doc.createElement('dialog');
      dialog.className = 'cover-dialog'; dialog.dataset.coverDialog = '';
      dialog.setAttribute('aria-label', T('封面预览', 'Cover preview'));
      const close = doc.createElement('button');
      close.type = 'button'; close.className = 'cover-dialog-close'; close.textContent = '×';
      close.setAttribute('aria-label', T('关闭封面预览', 'Close cover preview'));
      close.title = close.getAttribute('aria-label');
      const image = doc.createElement('img');
      image.alt = doc.querySelector('.book-main h1')?.textContent || thumbnail?.alt || '';
      const status = doc.createElement('p'); status.setAttribute('role', 'status');
      const again = doc.createElement('button');
      again.type = 'button'; again.className = 'cover-retry'; again.textContent = T('重试', 'Retry');
      function load() {
        status.textContent = T('正在加载封面…', 'Loading cover…');
        again.hidden = true; image.hidden = true; dialog.setAttribute('aria-busy', 'true');
        image.src = coverLink.href;
      }
      image.addEventListener('load', () => {
        dialog.setAttribute('aria-busy', 'false'); image.hidden = false; status.textContent = '';
      });
      image.addEventListener('error', () => {
        dialog.setAttribute('aria-busy', 'false'); again.hidden = false;
        status.textContent = T('封面暂时未能加载，请重试。', 'The cover could not be loaded. Please retry.');
      });
      close.addEventListener('click', () => dialog.close());
      again.addEventListener('click', load);
      dialog.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const last = again.hidden ? close : again;
        if (e.shiftKey && doc.activeElement === close) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); close.focus(); }
      });
      dialog.addEventListener('click', e => {
        if (e.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
      });
      dialog.addEventListener('close', () => {
        dialog.remove(); doc.documentElement.classList.remove('cover-dialog-open');
        coverLink.focus({ preventScroll: true });
      }, { once: true });
      dialog.append(close, image, status, again); doc.body.append(dialog);
      dialog.showModal(); close.focus({ preventScroll: true });
      doc.documentElement.classList.add('cover-dialog-open'); load();
    });
  }
  function paint(button, expanded) {
    button.setAttribute('aria-expanded', String(expanded));
    button.querySelector('span').textContent = expanded ? button.dataset.collapse : button.dataset.expand;
  }
  // Keep the clicked control in view when collapsing a long section.
  function keepPosition(button, change) {
    const rect = button.getBoundingClientRect();
    const before = Math.max(12, Math.min(rect.top, window.innerHeight - rect.height - 12));
    change();
    const delta = button.getBoundingClientRect().top - before;
    if (delta) window.scrollBy(0, delta);
    const after = button.getBoundingClientRect();
    if (after.top < 0 || after.bottom > window.innerHeight) button.scrollIntoView({ block: 'nearest' });
  }

  const description = doc.querySelector('[data-desc]');
  const toggle = doc.querySelector('[data-desc-toggle]');
  if (description && toggle) {
    const text = description.querySelector('p');
    let expanded = false;
    function measure() {
      description.classList.add('clamped');
      const overflows = text.scrollHeight > text.clientHeight + 1;
      description.classList.toggle('clamped', overflows && !expanded);
      toggle.hidden = !overflows;
      paint(toggle, overflows && expanded);
    }
    toggle.addEventListener('click', () => {
      const collapse = expanded;
      const change = () => {
        expanded = !expanded;
        description.classList.toggle('clamped', !expanded);
        paint(toggle, expanded);
      };
      if (collapse) keepPosition(toggle, change);
      else change();
    });
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    if (window.ResizeObserver) new window.ResizeObserver(schedule).observe(text);
    window.addEventListener('resize', schedule);
    if (doc.fonts) doc.fonts.ready.then(schedule);
    measure();
  }

  const catalog = doc.querySelector('[data-catalog]');
  const catalogToggle = doc.querySelector('[data-catalog-more]');
  if (catalog && catalogToggle) {
    const rows = Array.from(catalog.querySelectorAll('.chapter-row'));
    const tail = rows.slice(12);
    let expanded = false;
    function update() {
      tail.forEach(row => { row.hidden = !expanded; });
      paint(catalogToggle, expanded);
    }
    catalogToggle.hidden = tail.length === 0;
    catalogToggle.addEventListener('click', () => {
      const collapse = expanded;
      const change = () => { expanded = !expanded; update(); };
      if (collapse) keepPosition(catalogToggle, change);
      else change();
    });
    update();
  }
})();
