'use strict';
/* global window, document, MutationObserver */
(function () {
  const covers = '.cover-slot .cover-art,.rec-cover,.rk-coverbox .cover-art,.rel-cover,.card .cv,.wk .cv,.rk-cov,.pd-cov,.dp-cover';
  const lists = '.shelf,.rail,.continue-strip,.theme-list,.boards,.related-grid,.grid,.works,.rk-list,.podium,.rank-hero';
  const bound = new WeakSet(), failed = new Map(), notices = new Map();
  const T = (zh, en) => (window.EvoronLanguage?.state().language || document.documentElement.lang).startsWith('en') ? en : zh;
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(sync);
  }
  function clear(image, entry) {
    entry.cover.classList.remove('list-cover-unavailable');
    entry.label.remove(); failed.delete(image);
  }
  function bind(image) {
    if (bound.has(image) || image.closest('[data-cover-zoom]')) return;
    const cover = image.closest(covers), list = cover?.closest(lists);
    if (!cover || !list || list.closest('a')) return;
    bound.add(image);
    image.addEventListener('load', () => {
      const entry = failed.get(image);
      if (entry) clear(image, entry);
      schedule();
    });
    function fail() {
      let entry = failed.get(image);
      if (!entry) {
        const label = document.createElement('span');
        label.className = 'list-cover-fallback'; label.textContent = '!';
        label.setAttribute('role', 'img'); label.setAttribute('translate', 'no');
        cover.append(label); cover.classList.add('list-cover-unavailable');
        entry = { cover, list, label }; failed.set(image, entry);
      }
      entry.pending = false; schedule();
    }
    image.addEventListener('error', fail);
    if (image.complete && !image.naturalWidth && image.getAttribute('src')) fail();
  }
  function sync() {
    scheduled = false;
    document.querySelectorAll(covers).forEach(cover => cover.querySelectorAll('img').forEach(bind));
    const groups = new Map();
    for (const [image, entry] of failed) {
      if (!image.isConnected || !entry.list.contains(image)) { clear(image, entry); continue; }
      const label = T('封面暂不可用', 'Cover unavailable');
      entry.label.setAttribute('aria-label', label); entry.label.title = label;
      if (!groups.has(entry.list)) groups.set(entry.list, []);
      groups.get(entry.list).push([image, entry]);
    }
    for (const [list, notice] of notices) {
      if (groups.has(list)) continue;
      if (notice.node.contains(document.activeElement) || (notice.restoreFocus && document.activeElement === document.body)) {
        list.querySelector('a')?.focus({ preventScroll: true });
      }
      notice.node.remove(); notices.delete(list);
    }
    for (const [list, entries] of groups) {
      let notice = notices.get(list);
      if (!notice) {
        const node = document.createElement('div'), message = document.createElement('span'), retry = document.createElement('button');
        node.className = 'list-cover-notice'; node.setAttribute('translate', 'no');
        message.setAttribute('role', 'status');
        retry.type = 'button'; retry.textContent = '↻'; retry.dataset.retryCovers = '';
        retry.addEventListener('click', () => {
          notice.restoreFocus = node.contains(document.activeElement);
          for (const [image, entry] of failed) {
            if (entry.list !== list || entry.pending || !image.isConnected) continue;
            entry.pending = true;
            image.loading = 'eager';
            image.src = image.getAttribute('src');
          }
          sync();
        });
        node.append(message, retry); list.before(node);
        notice = { node, message, retry }; notices.set(list, notice);
      }
      if (notice.node.hidden !== list.hidden) notice.node.hidden = list.hidden;
      const pending = entries.some(([, entry]) => entry.pending);
      const text = pending ? T('正在重试封面…', 'Retrying covers…') : T('部分封面暂不可用', 'Some covers are unavailable');
      if (notice.message.textContent !== text) notice.message.textContent = text;
      notice.retry.disabled = pending;
      const label = T('重试封面', 'Retry covers');
      notice.retry.setAttribute('aria-label', label); notice.retry.title = label;
    }
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('evoron:language', schedule);
  sync();
})();
