'use strict';
/* global window */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvoronShelf = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  async function request(win, body) {
    const controller = new win.AbortController();
    const timer = win.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await win.fetch('/api/reader/shelf', {
        credentials: 'same-origin', signal: controller.signal,
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        const error = new Error('Shelf request failed');
        error.code = response.status === 401 || data.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : data.code;
        throw error;
      }
      return data;
    } finally { win.clearTimeout(timer); }
  }
  function language(win) {
    const explicit = new URLSearchParams(win.location.search).get('lang');
    if (explicit === 'en' || explicit === 'zh') return explicit;
    try { return win.localStorage.getItem('hai.shelfLang') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
  }
  function readHref(row) {
    const dir = '/books/' + encodeURIComponent(row.bookId) + '/';
    return row.releaseId && Number.isInteger(Number(row.chapter)) && Number(row.chapter) >= 0
      ? dir + 'releases/' + encodeURIComponent(row.releaseId) + '/ch-' + (Number(row.chapter) + 1) + '.html'
      : dir + 'index.html';
  }
  function installDetail(win, book) {
    const doc = win.document, en = doc.documentElement.lang.startsWith('en');
    const T = (zh, english) => en ? english : zh;
    const buttons = [...doc.querySelectorAll('[data-shelf-status]')];
    const box = doc.querySelector('[data-shelf-acts]');
    if (!box) return;
    const notice = doc.createElement('p'); notice.setAttribute('role', 'status'); notice.className = 'shelf-notice';
    box.after(notice);
    const retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = T('重试', 'Retry'); retry.hidden = true;
    notice.after(retry);
    const login = doc.createElement('a'); login.textContent = T('登录后加入书架', 'Sign in to add to shelf');
    login.href = (en ? '/index-en.html' : '/index.html') + '?login=1&returnTo=' + encodeURIComponent(win.location.pathname);
    login.hidden = true; retry.after(login);
    let current = '', busy = false, last = null, syncUserId;
    function paint() { buttons.forEach(b => { b.classList.toggle('on', b.dataset.shelfStatus === current); b.setAttribute('aria-pressed', String(b.dataset.shelfStatus === current)); b.disabled = busy; }); }
    async function run(body) {
      if (busy) return;
      busy = true; last = body; retry.hidden = true; login.hidden = true; paint();
      notice.textContent = body ? T('正在保存…', 'Saving…') : T('正在读取书架…', 'Loading shelf…');
      try {
        const data = await request(win, body);
        if (!body) syncUserId = data.syncUserId;
        const row = body ? null : (data.rows || []).find(r => r.bookId === book.projectId);
        current = body ? data.status || '' : row?.status || '';
        notice.textContent = body ? T('已保存', 'Saved') : '';
        if (row && row.releaseId === book.releaseId && row.status !== 'wishlist') {
          const button = doc.querySelector('[data-continue-reading]');
          if (button && Number(row.chapter) < book.chapterCount) { button.href = readHref(row); button.textContent = T('继续阅读', 'Continue reading'); }
        }
      } catch (error) {
        const auth = error.code === 'AUTH_REQUIRED';
        notice.textContent = auth ? T('阅读无需登录。', 'You can read without signing in.') : T('书架暂时不可用，未更改原状态。', 'Shelf unavailable. Your previous state is unchanged.');
        login.hidden = !auth; retry.hidden = auth;
      } finally { busy = false; paint(); }
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      if (button.dataset.shelfStatus === current) return;
      run({ bookId: book.projectId, title: book.title, status: button.dataset.shelfStatus, syncUserId });
    }));
    retry.addEventListener('click', () => run(last));
    run();
  }
  function installPage(win) {
    const doc = win.document, en = language(win) === 'en';
    const T = (zh, english) => en ? english : zh;
    const main = doc.getElementById('main');
    if (!main) return;
    doc.documentElement.lang = en ? 'en' : 'zh';
    doc.title = T('我的书架', 'My shelf') + ' · EVORON AI';
    const labels = { '我的书架': 'My shelf', '书架': 'Shelf', '笔记本': 'Notebook', '书城首页': 'Bookstore', '书城': 'Store', '社区动态': 'Community', '我的主页': 'My profile', '动态': 'Community', '我的': 'Me' };
    if (en) doc.querySelectorAll('h1,.brand-cn,.topbar-link,.mtb-t,[data-stab]').forEach(e => { e.textContent = labels[e.textContent] || e.textContent; });
    doc.querySelectorAll('a[href="/index.html"]').forEach(a => { a.href = en ? '/index-en.html' : '/index.html'; });
    const params = new URLSearchParams(win.location.search);
    let active = ['reading', 'wishlist', 'finished'].includes(params.get('status')) ? params.get('status') : '';
    const statusNames = { reading: T('在读', 'Reading'), wishlist: T('想读', 'Want to read'), finished: T('读完', 'Finished') };
    const controls = doc.createElement('nav'); controls.className = 'shelf-filters'; controls.setAttribute('aria-label', T('阅读状态', 'Reading status'));
    main.before(controls);
    const notice = doc.createElement('p'); notice.setAttribute('role', 'status'); notice.className = 'shelf-feedback'; main.before(notice);
    let rows = [], undo = null, saving = false, syncUserId;
    function el(tag, cls, text) { const e = doc.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; }
    function button(text, fn) { const b = el('button', '', text); b.type = 'button'; b.addEventListener('click', fn); return b; }
    function errorBox(error) {
      main.replaceChildren();
      const box = el('div', 'empty', error.code === 'AUTH_REQUIRED' ? T('登录后同步你的书架。', 'Sign in to sync your shelf.') : T('书架暂时打不开，阅读记录仍然保留。', 'Your shelf is unavailable. Your reading history is preserved.'));
      if (error.code === 'AUTH_REQUIRED') {
        const a = el('a', '', T('登录', 'Sign in'));
        a.href = (en ? '/index-en.html' : '/index.html') + '?login=1&returnTo=' + encodeURIComponent(win.location.pathname + win.location.search);
        box.append(doc.createElement('br'), a);
      } else box.append(button(T('重试', 'Retry'), load));
      main.append(box);
    }
    async function save(row, status) {
      if (saving) return;
      saving = true;
      const oldStatus = row.status;
      const allButtons = [...main.querySelectorAll('button')]; allButtons.forEach(b => { b.disabled = true; });
      notice.textContent = T('正在保存…', 'Saving…');
      try {
        await request(win, { bookId: row.bookId, title: row.title, status, syncUserId });
        if (status === 'remove') rows = rows.filter(r => r.bookId !== row.bookId);
        else { row.status = status; if (!rows.includes(row)) rows.push(row); }
        undo = { row, status: oldStatus };
        notice.replaceChildren(doc.createTextNode(T('已保存。', 'Saved. ')), button(T('撤销', 'Undo'), () => {
          const previous = undo; undo = null;
          save(previous.row, previous.status);
        }));
        render();
      } catch (error) {
        notice.textContent = error.code === 'AUTH_REQUIRED' ? T('登录已过期，未保存。', 'Session expired. Changes were not saved.') : T('保存失败，原状态未改变。请重试。', 'Save failed. Your previous state is unchanged. Please retry.');
      } finally { saving = false; allButtons.forEach(b => { b.disabled = false; }); }
    }
    function render() {
      controls.replaceChildren();
      ['', 'reading', 'wishlist', 'finished'].forEach(status => {
        const count = status ? rows.filter(r => r.status === status).length : rows.length;
        const b = button((statusNames[status] || T('全部', 'All')) + ' ' + count, () => {
          active = status; const url = new URL(win.location.href); if (active) url.searchParams.set('status', active); else url.searchParams.delete('status');
          win.history.replaceState(win.history.state, '', url); render();
        }); b.classList.toggle('on', status === active); b.setAttribute('aria-pressed', String(status === active)); controls.append(b);
      });
      main.replaceChildren();
      const filtered = rows.filter(r => !active || r.status === active);
      if (!filtered.length) {
        const empty = el('div', 'empty', T('这里还没有书。', 'No books here yet.'));
        const browse = el('a', '', T('去书城找一本', 'Find a book')); browse.href = en ? '/index-en.html' : '/index.html';
        empty.append(doc.createElement('br'), browse); main.append(empty); return;
      }
      const grid = el('div', 'grid');
      filtered.forEach(row => {
        const card = el('article', 'card');
        const link = el('a', 'cv'); link.href = readHref(row); link.setAttribute('aria-label', T('阅读：', 'Read: ') + row.title);
        if (row.cover) { const image = el('img', ''); image.loading = 'lazy'; image.src = row.cover; image.alt = row.title; link.append(image); }
        else link.append(el('span', 'ph', row.title));
        const pct = row.n && row.releaseId ? Math.min(100, Math.round((Number(row.chapter) + 1) / row.n * 100)) : null;
        if (pct != null && row.status === 'reading') { const bar = el('span', 'pbar'), fill = el('i', ''); fill.style.width = pct + '%'; bar.append(fill); link.append(bar); }
        if (row.status === 'finished') link.append(el('span', 'done', T('读完', 'Finished')));
        const title = el('a', 't', row.title || T('书目不可用', 'Book unavailable')); title.href = '/books/' + encodeURIComponent(row.bookId) + '/index.html';
        const detail = el('div', 's', (statusNames[row.status] || '') + (row.releaseId && row.status !== 'wishlist' ? T(' · 第', ' · Chapter ') + (Number(row.chapter) + 1) + (en ? '' : '章') + (pct == null ? '' : ' · ' + pct + '%') : ''));
        const actions = el('div', 'acts');
        if (row.status !== 'finished') actions.append(button(T('标记读完', 'Mark finished'), () => save(row, 'finished')));
        actions.append(button(T('移出书架', 'Remove'), () => save(row, 'remove')));
        card.append(link, title, detail, actions); grid.append(card);
      }); main.append(grid);
    }
    async function load() {
      main.replaceChildren(el('div', 'empty', T('正在打开书架…', 'Loading shelf…')));
      try { const data = await request(win); rows = data.rows || []; syncUserId = data.syncUserId; render(); } catch (error) { errorBox(error); }
    }
    doc.querySelectorAll('[data-stab]').forEach(b => b.addEventListener('click', () => { controls.hidden = notice.hidden = b.dataset.stab === 'notes'; }));
    win.addEventListener('pageshow', e => { if (e.persisted) load(); });
    load();
  }
  return { request, language, readHref, installDetail, installPage };
});
