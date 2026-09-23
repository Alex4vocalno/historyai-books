'use strict';
/* global window */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvoronDiscovery = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  function normalized(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim(); }
  const aliases = [
    ['女神异闻录', 'persona'], ['人工智能', 'artificial intelligence', 'ai'],
    ['心理学', 'psychology'], ['荣格', 'carl jung', 'jung'],
    ['电子游戏', 'video games', 'videogames'], ['科幻', 'science fiction', 'sci-fi'],
    ['第二次世界大战', '二战', 'world war ii', 'wwii'],
  ];
  const aliasPattern = new RegExp(aliases.flat().sort((a, b) => b.length - a.length).join('|'), 'gu');
  function searchText(value) {
    return normalized(value).replace(aliasPattern, (match, offset, text) => {
      if (/^[a-z]/.test(match) && (/[a-z0-9]/.test(text[offset - 1] || '') || /[a-z0-9]/.test(text[offset + match.length] || ''))) return match;
      return aliases.find(group => group.includes(match))[0];
    });
  }
  function relevance(book, query, terms) {
    const title = normalized(book.t), author = normalized(book.a);
    if (title === query) return 600;
    if (title.includes(query)) return 500;
    if (terms.every(term => searchText(title).includes(term))) return 400;
    if (author === query) return 350;
    if (author.includes(query)) return 300;
    if (terms.every(term => searchText(author).includes(term))) return 250;
    if (terms.every(term => searchText([book.g, book.categoryEn].join(' ')).includes(term))) return 200;
    return 0;
  }
  function categoryKey(value, pool) {
    if (!value || value === 'all') return '';
    const book = pool.find(b => [b.categoryKey, b.categoryEn, b.g].includes(value));
    return book ? book.categoryKey || book.g : '';
  }
  function searchBooks(pool, state) {
    const query = normalized(state.q);
    const terms = searchText(query).split(' ').filter(Boolean);
    return pool.filter(b => terms.every(term => searchText([b.t, b.a, b.g, b.categoryEn, b.h].join(' ')).includes(term))
      && (!state.category || (b.categoryKey || b.g) === state.category)
      && (!state.kind || b.kind === state.kind)
      && (!state.language || b.lang === state.language))
      .sort((a, b) => (state.sort === 'score' ? b.s - a.s : state.sort === 'chapters' ? b.n - a.n : query ? relevance(b, query, terms) - relevance(a, query, terms) : 0)
        || b.at - a.at || a.i - b.i);
  }
  function parseState(search, pool) {
    const p = new URLSearchParams(search);
    const category = p.get('category') || '';
    const language = p.get('language') || '';
    return { q: (p.get('q') || '').slice(0, 200), category: categoryKey(category, pool),
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
  function recentBooks(pool, local, cloud = [], userId = '') {
    const books = new Map(pool.map(book => [book.p, book]));
    const rows = new Map();
    const time = row => Date.parse(row.updatedAt || '') || 0;
    function add(row) {
      const book = row && books.get(row.bookId);
      if (!book || !Number.isInteger(row.chapter) || row.chapter < 0 || row.chapter >= book.n
        || (row.releaseId && row.releaseId !== book.release)) return;
      const previous = rows.get(row.bookId);
      if (!previous || time(row) >= time(previous)) rows.set(row.bookId, row);
    }
    // Local progress belongs to its reader, not everyone using the same browser.
    local.filter(row => row && (row.readerUserId || '') === userId).forEach(add);
    cloud.forEach(row => { if (row?.status === 'reading') add(row); });
    cloud.forEach(row => { if (row && row.status !== 'reading') rows.delete(row.bookId); });
    return [...rows.values()].sort((a, b) => time(b) - time(a) || a.bookId.localeCompare(b.bookId)).slice(0, 4)
      .map(row => ({ b: books.get(row.bookId), ch: row.chapter, href: continueHref(books.get(row.bookId), row) }));
  }
  function install(win, pool, paint) {
    const doc = win.document;
    const input = doc.querySelector('[data-shelf-search]');
    if (input) input.maxLength = 200;
    let state = parseState(win.location.search, pool);
    let visible = 24;
    let composing = false;
    let restoring = false;
    let focusId = '';
    const key = () => 'evoron.discovery:' + win.location.pathname + win.location.search;
    function remember(link) {
      if (link) focusId = link.closest('[data-book-card]')?.dataset.pid || '';
      try { win.sessionStorage.setItem(key(), JSON.stringify({ y: win.scrollY, visible, focusId })); } catch { /* storage is optional */ }
    }
    function updateUrl() {
      const url = new URL(win.location.href);
      Object.entries(state).forEach(([k, v]) => { if (v && v !== 'default') url.searchParams.set(k, v); else url.searchParams.delete(k); });
      if (url.href !== win.location.href) win.history.replaceState(win.history.state, '', url.href);
    }
    function render() {
      if (input && input.value !== state.q) input.value = state.q;
      doc.querySelectorAll('[data-category-filter]').forEach(b => {
        const selected = b.dataset.categoryFilter === 'all' ? !state.category : Boolean(state.category) && categoryKey(b.dataset.categoryFilter, pool) === state.category;
        b.classList.toggle('on', selected); b.setAttribute('aria-pressed', String(selected));
      });
      doc.querySelectorAll('[data-discovery-filter]').forEach(b => {
        b.value = b.dataset.discoveryFilter === 'category'
          ? Array.from(b.options).find(option => categoryKey(option.value, pool) === state.category)?.value || ''
          : state[b.dataset.discoveryFilter];
      });
      const filterSummary = doc.querySelector('[data-filter-summary]');
      if (filterSummary) filterSummary.replaceChildren(...Array.from(doc.querySelectorAll('[data-discovery-filter]'))
        .filter(select => select.value).map(select => {
          const label = doc.createElement('span');
          label.textContent = select.selectedOptions[0]?.textContent || '';
          return label;
        }));
      doc.querySelectorAll('[data-sort]').forEach(b => {
        b.classList.toggle('on', b.dataset.sort === state.sort); b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));
      });
      const languageLink = doc.querySelector('.lang-switch');
      if (languageLink) {
        const url = new URL(languageLink.href, win.location.href);
        url.search = win.location.search;
        Object.entries(state).forEach(([k, v]) => { if (v && v !== 'default') url.searchParams.set(k, v); else url.searchParams.delete(k); });
        url.searchParams.set('lang', url.pathname.endsWith('index-en.html') ? 'en' : 'zh');
        url.hash = win.location.hash;
        languageLink.href = url.href;
      }
      const matches = searchBooks(pool, state);
      paint(matches.slice(0, visible), matches.length, state);
    }
    function change(patch) {
      remember();
      if ('category' in patch) patch = { ...patch, category: categoryKey(patch.category, pool) };
      state = { ...state, ...patch }; visible = 24; focusId = ''; updateUrl(); render();
    }
    function restore() {
      restoring = true; state = parseState(win.location.search, pool); visible = 24;
      let y = 0; focusId = '';
      try {
        const saved = JSON.parse(win.sessionStorage.getItem(key()) || '{}');
        visible = Math.max(24, Math.min(pool.length || 24, Number(saved.visible) || 24));
        y = Number.isFinite(saved.y) ? Math.max(0, saved.y) : 0;
        focusId = typeof saved.focusId === 'string' ? saved.focusId : '';
      } catch { /* first visit */ }
      render();
      win.requestAnimationFrame(() => {
        win.scrollTo(0, y);
        const card = Array.from(doc.querySelectorAll('[data-book-card]')).find(el => el.dataset.pid === focusId);
        card?.focus({ preventScroll: true });
        restoring = false;
      });
    }
    function results() { doc.querySelector('[data-all-books]')?.scrollIntoView({ block: 'start' }); }
    doc.querySelector('a[href="#all-books"]')?.addEventListener('click', e => { e.preventDefault(); results(); });
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
    doc.querySelector('[data-search-clear]')?.addEventListener('click', () => {
      change({ q: '', category: '', kind: '', language: '' }); input?.focus({ preventScroll: true });
    });
    doc.addEventListener('click', e => {
      if (e.target.closest('[data-search-relax]')) change({ category: '', kind: '', language: '' });
      if (e.target.closest('[data-search-edit]')) input?.focus({ preventScroll: true });
    });
    const more = doc.querySelector('[data-shelf-more]');
    function loadMore() { if (restoring || more?.hidden) return; visible += 24; render(); }
    more?.addEventListener('click', loadMore);
    if (more && win.IntersectionObserver) new win.IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadMore();
    }, { rootMargin: '300px 0px' }).observe(more);
    win.addEventListener('pagehide', () => remember());
    doc.addEventListener('click', e => { const link = e.target.closest('a'); if (link) remember(link); });
    win.addEventListener('popstate', restore);
    win.addEventListener('evoron:language', () => win.queueMicrotask(render));
    win.addEventListener('pageshow', e => { if (e.persisted) restore(); });
    restore();
    return { remember };
  }
  return { normalized, searchBooks, parseState, continueHref, recentBooks, install };
});
