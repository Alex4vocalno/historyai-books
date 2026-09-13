/* global window */
'use strict';

(function (win) {
  const doc = win.document;
  const notebook = doc.getElementById('notebook');
  const booksPanel = doc.getElementById('shelf-books');
  if (!notebook || !booksPanel) return;
  const en = win.EvoronShelf.language(win) === 'en';
  const T = (zh, english) => en ? english : zh;
  const tabs = Array.from(doc.querySelectorAll('[data-stab]'));
  let loaded = false, loading = false, deleting = false;
  const feedback = doc.createElement('p'); feedback.className = 'notebook-feedback'; feedback.setAttribute('role', 'status');
  notebook.before(feedback);
  function el(tag, cls, text) {
    const node = doc.createElement(tag); node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function button(label, action) {
    const node = el('button', '', label); node.type = 'button'; node.addEventListener('click', action); return node;
  }
  async function request(url, body) {
    const controller = new win.AbortController();
    const timeout = win.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await win.fetch(url, { credentials: 'same-origin', signal: controller.signal,
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok || (data && data.ok === false)) {
        const error = new Error('Notebook unavailable'); error.code = response.status === 401 || data?.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'UNAVAILABLE'; throw error;
      }
      return data;
    } finally { win.clearTimeout(timeout); }
  }
  function message(text, action) {
    const box = el('div', 'empty', text); if (action) box.append(doc.createElement('br'), action); notebook.replaceChildren(box);
  }
  function linkToBook(bookId) { return '/books/' + encodeURIComponent(bookId) + '/index.html'; }
  async function remove(bookId, kind, item) {
    if (deleting || !win.confirm(T('删除这条' + (kind === 'review' ? '点评' : '笔记') + '？', 'Delete this ' + (kind === 'review' ? 'review' : 'note') + '?'))) return;
    deleting = true; feedback.textContent = T('正在删除…', 'Deleting…');
    const buttons = Array.from(notebook.querySelectorAll('button')); buttons.forEach(b => { b.disabled = true; });
    try {
      const result = await request('/api/book/delete', { bookId, kind, id: item.id });
      if (!result?.ok) throw new Error('Delete not confirmed');
      feedback.textContent = T('已删除。', 'Deleted.'); loaded = false; await load();
    } catch {
      feedback.textContent = T('删除未能确认，内容仍保留在页面中。请刷新确认后重试。', 'Deletion could not be confirmed. The content remains on this page. Refresh to check before retrying.');
    } finally { deleting = false; buttons.forEach(b => { b.disabled = false; }); }
  }
  function render(data, catalog) {
    const groups = data.books || [];
    const browse = el('a', '', T('去书城找一本', 'Find a book')); browse.href = en ? '/index-en.html' : '/index.html';
    if (!groups.length) { message(T('还没有笔记。', 'No notes yet.'), browse); return; }
    const titles = new Map(catalog.map(book => [book.projectId || book.id, book.title]));
    notebook.replaceChildren();
    groups.forEach(group => {
      const section = el('section', 'nb-book'), head = el('div', 'nb-head');
      const title = el('a', '', titles.get(group.bookId) || T('书目不可用', 'Book unavailable')); title.href = linkToBook(group.bookId);
      const notes = (group.notes || []).slice().reverse(), reviews = group.reviews || [];
      head.append(title, el('small', '', (notes.length + reviews.length) + T(' 条', ' entries'))); section.append(head);
      [...notes.map(item => ({ item, kind: 'note' })), ...reviews.map(item => ({ item, kind: 'review' }))].forEach(({ item, kind }) => {
        const entry = el('div', 'nb-item');
        if (kind === 'note') entry.append(el('blockquote', 'nb-quote', item.quote || ''));
        else entry.append(el('span', 'nb-stars', '★★★★★'.slice(0, Math.max(0, Math.min(5, Number(item.rating) || 0)))));
        if (item.text) entry.append(el('p', 'nb-text', item.text));
        const chapter = kind === 'note' ? T('第 ' + (Number(item.chapter) || 1) + ' 章 · ', 'Chapter ' + (Number(item.chapter) || 1) + ' · ') : '';
        const type = kind === 'review' ? T('点评', 'Review') : item.text ? T('想法', 'Thought') : T('划线', 'Highlight');
        const meta = el('div', 'nb-meta');
        meta.append(el('span', '', chapter + String(item.at || '').slice(0, 10) + ' · ' + type), button(T('删除', 'Delete'), () => remove(group.bookId, kind, item)));
        entry.append(meta); section.append(entry);
      });
      notebook.append(section);
    });
  }
  async function load() {
    if (loading) return;
    loading = true; notebook.setAttribute('aria-busy', 'true');
    message(T('正在整理笔记…', 'Loading notes…'));
    try {
      const [data, catalog] = await Promise.all([request('/api/book/my-notes'), request('/books/index.json').catch(() => [])]);
      if (!data?.ok || !Array.isArray(data.books)) throw new Error('Invalid notebook response');
      render(data, Array.isArray(catalog) ? catalog : []); loaded = true;
    } catch (error) {
      loaded = false;
      if (error.code === 'AUTH_REQUIRED') {
        const signIn = el('a', '', T('登录', 'Sign in'));
        signIn.href = (en ? '/index-en.html' : '/index.html') + '?login=1&returnTo=' + encodeURIComponent(win.location.pathname + win.location.search);
        message(T('登录后查看你的笔记。', 'Sign in to view your notes.'), signIn);
      } else message(T('笔记暂时打不开，已保存的内容不会因此删除。', 'Notes are unavailable. Your saved content has not been deleted.'), button(T('重试', 'Retry'), load));
    } finally { loading = false; notebook.setAttribute('aria-busy', 'false'); }
  }
  function select(name, updateUrl) {
    const notes = name === 'notes';
    tabs.forEach(tab => { const on = (tab.dataset.stab === 'notes') === notes; tab.classList.toggle('on', on); tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; });
    booksPanel.hidden = notes; notebook.hidden = feedback.hidden = !notes;
    if (updateUrl) {
      const url = new URL(win.location.href); if (notes) url.searchParams.set('view', 'notes'); else url.searchParams.delete('view');
      win.history.replaceState(win.history.state, '', url);
    }
    if (notes && !loaded) load();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.stab, true));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[next].dataset.stab, true); tabs[next].focus();
    });
  });
  select(new URLSearchParams(win.location.search).get('view'), false);
})(window);
