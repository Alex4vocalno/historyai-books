'use strict';
/* global window */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvoronDiscovery = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  function normalized(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim(); }
  function searchBooks(pool, state) {
    const terms = normalized(state.q).split(' ').filter(Boolean);
    return pool.filter(b => terms.every(term => normalized(b.h).includes(term))
      && (!state.category || b.g === state.category)
      && (!state.kind || b.kind === state.kind)
      && (!state.language || b.lang === state.language))
      .sort((a, b) => (state.sort === 'score' ? b.s - a.s : state.sort === 'chapters' ? b.n - a.n : 0)
        || b.at - a.at || a.i - b.i);
  }
  function parseState(search, pool) {
    const p = new URLSearchParams(search);
    const category = p.get('category') || '';
    const language = p.get('language') || '';
    return { q: (p.get('q') || '').slice(0, 200), category: pool.some(b => b.g === category) ? category : '',
      kind: ['fiction', 'nonfiction'].includes(p.get('kind')) ? p.get('kind') : '',
      language: pool.some(b => b.lang === language) ? language : '',
      sort: ['score', 'chapters'].includes(p.get('sort')) ? p.get('sort') : 'default' };
  }
  function continueHref(book, progress) {
    const base = book.r || book.u || '#';
    if (!progress || !Number.isInteger(Number(progress.chapter)) || Number(progress.chapter) < 0) return base;
    const chapter = Number(progress.chapter);
    if (book.n && chapter >= book.n) return base;
    // Never apply a loose local path to a different release or leave the book's directory.
    if (progress.releaseId && progress.releaseId !== book.release) return base;
    return base.replace(/(?:read|ch-\d+)\.html(?:[?#].*)?$/, 'ch-' + (chapter + 1) + '.html');
  }
  function install(win, pool, paint) {
    const doc = win.document;
    const input = doc.querySelector('[data-shelf-search]');
    if (input) input.maxLength = 200;
    let state = parseState(win.location.search, pool);
    let visible = 24;
    let composing = false;
    let restoring = false;
    const key = () => 'evoron.discovery:' + win.location.pathname + win.location.search;
    function remember() {
      try { win.sessionStorage.setItem(key(), JSON.stringify({ y: win.scrollY, visible })); } catch { /* storage is optional */ }
    }
    function updateUrl() {
      const url = new URL(win.location.href);
      Object.entries(state).forEach(([k, v]) => { if (v && v !== 'default') url.searchParams.set(k, v); else url.searchParams.delete(k); });
      if (url.href !== win.location.href) win.history.replaceState(win.history.state, '', url.href);
    }
    function render() {
      if (input && input.value !== state.q) input.value = state.q;
      doc.querySelectorAll('[data-category-filter]').forEach(b => {
        const selected = b.dataset.categoryFilter === (state.category || 'all');
        b.classList.toggle('on', selected); b.setAttribute('aria-pressed', String(selected));
      });
      doc.querySelectorAll('[data-discovery-filter]').forEach(b => { b.value = state[b.dataset.discoveryFilter]; });
      doc.querySelectorAll('[data-sort]').forEach(b => {
        b.classList.toggle('on', b.dataset.sort === state.sort); b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));
      });
      const matches = searchBooks(pool, state);
      paint(matches.slice(0, visible), matches.length, state);
    }
    function change(patch) { remember(); state = { ...state, ...patch }; visible = 24; updateUrl(); render(); }
    function restore() {
      restoring = true; state = parseState(win.location.search, pool); visible = 24;
      let y = 0;
      try { const saved = JSON.parse(win.sessionStorage.getItem(key()) || '{}'); visible = Math.max(24, Math.min(pool.length || 24, Number(saved.visible) || 24)); y = Number(saved.y) || 0; } catch { /* first visit */ }
      render();
      win.requestAnimationFrame(() => { win.scrollTo(0, y); restoring = false; });
    }
    function results() { doc.querySelector('[data-all-books]')?.scrollIntoView({ block: 'start' }); }
    input?.addEventListener('compositionstart', () => { composing = true; });
    input?.addEventListener('compositionend', () => { composing = false; change({ q: input.value }); });
    input?.addEventListener('input', () => { if (!composing) change({ q: input.value }); });
    input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !composing) { e.preventDefault(); change({ q: input.value }); results(); input.blur(); } });
    doc.querySelectorAll('[data-category-filter], [data-category-tile], [data-hot]').forEach(b => b.addEventListener('click', () => {
      const value = b.dataset.categoryFilter || b.dataset.categoryTile || b.dataset.hot;
      change({ category: value === 'all' ? '' : value }); results();
    }));
    doc.querySelectorAll('[data-discovery-filter]').forEach(b => b.addEventListener('change', () => change({ [b.dataset.discoveryFilter]: b.value })));
    doc.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => change({ sort: b.dataset.sort })));
    doc.querySelector('[data-search-clear]')?.addEventListener('click', () => change({ q: '', category: '', kind: '', language: '' }));
    const more = doc.querySelector('[data-shelf-more]');
    function loadMore() { if (restoring || more?.hidden) return; visible += 24; render(); }
    more?.addEventListener('click', loadMore);
    if (more && win.IntersectionObserver) new win.IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadMore();
    }, { rootMargin: '300px 0px' }).observe(more);
    win.addEventListener('pagehide', remember);
    doc.addEventListener('click', e => { if (e.target.closest('a')) remember(); });
    win.addEventListener('popstate', restore);
    win.addEventListener('pageshow', e => { if (e.persisted) restore(); });
    restore();
    return { remember };
  }
  return { normalized, searchBooks, parseState, continueHref, install };
});
