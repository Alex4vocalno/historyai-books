/* global document, localStorage */
(function () {
  'use strict';
  const key = 'evoron.welcome.dismissed';
  const en = document.documentElement.lang.toLowerCase().startsWith('en');
  const pages = en ? [
    { label: 'Welcome to EvoronAI', title: 'A global generative library.', copy: 'Anyone can bring the book they want to read into being, and share it with the world.', detail: 'You do not have to limit your curiosity to books that already exist. Read what others have created, or create the book you have been looking for.' },
    { label: 'Your interests. Your perspective. Your language.', title: 'Your curiosity deserves a book.', copy: 'Even if your interest is niche, your perspective is different, or no book is available in your language, what you want to read can be the starting point.', detail: 'No subject has just one story. Your language, perspective and curiosity can open up another way to explore it.' },
    { label: 'From a reading wish to a book', title: 'Want to read it? Help bring it to life.', copy: 'Tell AI about the book you want to read. Shape its subject, language, style and length through conversation, then confirm your choices and begin writing.', detail: 'Fiction or nonfiction, from outline to chapters. Creating a book can be how a reader meets their own reading needs, not just a profession for authors.' },
    { label: 'Created for you. Shared by choice.', title: 'A book for you. A discovery for the world.', copy: 'Keep your book for yourself, or choose to publish it under your pen name so that others can discover and read it.', detail: 'A book born of your curiosity may answer someone else\'s wish. Every book shared makes this global library richer.' },
  ] : [
    { label: '欢迎来到 EvoronAI', title: '全球生成式图书馆', copy: '任何人都可以让自己想读的书出现，并把它留给全世界。', detail: '你不必只在已有的书里寻找答案。在这里，你可以阅读别人创造的书，也可以让自己一直想读的那一本出现。' },
    { label: '你的兴趣 · 你的视角 · 你的语言', title: '你的好奇，值得一本书。', copy: '哪怕主题小众、角度特别，或还没有你所用语言的版本，都可以从“你想读什么”开始。', detail: '同一个主题，没有唯一的写法。你的语言、视角与好奇心，就是一本新书的起点。' },
    { label: '从一个阅读愿望，到一本书', title: '从“我想读”，到“我来创造”。', copy: '把你想读的书告诉 AI，通过对话确定主题、语言、风格与篇幅。确认设定后，再把想法写成可阅读的书。', detail: '从虚构到非虚构，从大纲到章节。创作不只是作者的职业，也可以是读者满足自己阅读需求的方式。' },
    { label: '为自己创造 · 自主选择分享', title: '为自己而生，留给全世界。', copy: '一本书可以留给自己，也可以由你选择发布，以你的笔名进入书城，让更多人发现和阅读。', detail: '一本书源于你的好奇，可能也回应他人的期待。每一次分享，都让这座全球图书馆更丰富。' },
  ];

  if (typeof document.createElement('dialog').showModal !== 'function') return;
  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = 'store-welcome-reopen';
  entry.textContent = en ? 'Meet EvoronAI' : '认识 EvoronAI';
  const footer = document.querySelector('.footer');
  if (footer) footer.appendChild(entry);

  let activeDialog;
  function openWelcome() {
    if (activeDialog && activeDialog.open) return;
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    activeDialog = dialog;
    let current = 0;
    dialog.className = 'store-welcome';
    dialog.tabIndex = -1;
    dialog.innerHTML = '<header class="store-welcome-header"><div class="store-welcome-brand"><img src="brand/evoron-mark.png" alt="" width="24" height="24"><span>EVORON AI</span></div>'
      + '<span class="store-welcome-count"></span><button type="button" class="store-welcome-close" aria-label="' + (en ? 'Close' : '关闭') + '" title="' + (en ? 'Close' : '关闭') + '">&times;</button></header>'
      + '<div class="store-welcome-content" aria-live="polite" aria-atomic="true"></div>'
      + '<footer class="store-welcome-nav"><button type="button" class="store-welcome-skip">' + (en ? 'Explore first' : '先逛逛') + '</button>'
      + '<button type="button" class="store-welcome-back" hidden><span aria-hidden="true">&larr;</span> ' + (en ? 'Previous' : '上一页') + '</button>'
      + '<button type="button" class="store-welcome-start"></button></footer>';
    const content = dialog.querySelector('.store-welcome-content');
    // Stacked grid items share the tallest page's natural height without fixed blank space.
    const articles = pages.map((page, index) => {
      const article = document.createElement('article');
      article.className = 'store-welcome-page';
      const kicker = document.createElement('p');
      kicker.className = 'store-welcome-kicker';
      kicker.textContent = page.label;
      const title = document.createElement('h1');
      title.id = 'store-welcome-title-' + index;
      title.textContent = page.title;
      const copy = document.createElement('p');
      copy.className = 'store-welcome-copy';
      copy.id = 'store-welcome-copy-' + index;
      copy.textContent = page.copy;
      const detail = document.createElement('p');
      detail.className = 'store-welcome-detail';
      detail.textContent = page.detail;
      article.append(kicker, title, copy, detail);
      content.appendChild(article);
      return article;
    });
    const next = dialog.querySelector('.store-welcome-start');
    const back = dialog.querySelector('.store-welcome-back');
    const skip = dialog.querySelector('.store-welcome-skip');
    function render() {
      articles.forEach((article, index) => {
        article.classList.toggle('is-current', index === current);
        article.inert = index !== current;
        article.setAttribute('aria-hidden', String(index !== current));
      });
      dialog.setAttribute('aria-labelledby', 'store-welcome-title-' + current);
      dialog.setAttribute('aria-describedby', 'store-welcome-copy-' + current);
      dialog.querySelector('.store-welcome-count').textContent = (current + 1) + ' / ' + pages.length;
      back.hidden = current === 0;
      skip.hidden = current !== 0;
      next.textContent = current === pages.length - 1 ? (en ? 'Start exploring' : '开始探索') : (en ? 'Continue' : '继续了解');
      content.scrollTop = 0;
    }
    function dismiss() { dialog.close(); }
    function advance() {
      if (current === pages.length - 1) dismiss();
      else { current++; render(); }
    }
    function previous() {
      if (current > 0) { current--; render(); if (back.hidden) next.focus(); }
    }
    render();
    dialog.querySelector('.store-welcome-close').addEventListener('click', dismiss);
    skip.addEventListener('click', dismiss);
    next.addEventListener('click', advance);
    back.addEventListener('click', previous);
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' && current < pages.length - 1) { event.preventDefault(); current++; render(); next.focus(); }
      if (event.key === 'ArrowLeft' && current > 0) { event.preventDefault(); previous(); next.focus(); }
      if (event.key !== 'Tab') return;
      const first = dialog.querySelector('.store-welcome-close');
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); next.focus(); }
      else if (!event.shiftKey && document.activeElement === next) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
    });
    dialog.addEventListener('close', function () {
      try { localStorage.setItem(key, '1'); } catch { /* Browsing still works without storage. */ }
      document.documentElement.classList.remove('store-welcome-open');
      dialog.remove();
      activeDialog = null;
      const target = previousFocus && previousFocus !== document.body && previousFocus.isConnected
        ? previousFocus : document.querySelector('[data-shelf-search]');
      if (target) target.focus({ preventScroll: true });
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    document.documentElement.classList.add('store-welcome-open');
  }
  entry.addEventListener('click', openWelcome);
  try { if (localStorage.getItem(key) === '1') return; } catch { /* Storage is optional. */ }
  openWelcome();
}());
