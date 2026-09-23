'use strict';

(function (root) {
  const valid = value => ['system', 'zh', 'en'].includes(value);
  function resolve(preference, navigator) {
    if (preference === 'zh' || preference === 'en') return preference;
    return /^zh(?:-|$)/i.test(navigator?.languages?.[0] || navigator?.language || 'en') ? 'zh' : 'en';
  }
  function create(win) {
    let preference = 'system', userId = null, revision = 0, sequence = 0, loaded = false, saving = false;
    const cookieName = 'evoron_ui_language';
    const channel = typeof win.BroadcastChannel === 'function' ? new win.BroadcastChannel('evoron-ui-language') : null;
    function guestPreference() {
      const match = win.document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(cookieName + '='));
      const value = match?.slice(cookieName.length + 1);
      return valid(value) ? value : 'system';
    }
    preference = guestPreference();
    const state = () => ({ preference, language: resolve(preference, win.navigator), authenticated: Boolean(userId), loaded });
    let lastAnnounced = JSON.stringify(state());
    function announce() {
      const next = JSON.stringify(state());
      if (next === lastAnnounced) return;
      lastAnnounced = next;
      win.dispatchEvent(new win.CustomEvent('evoron:language', { detail: state() }));
    }
    async function refresh() {
      if (saving) return state();
      const request = ++sequence;
      const controller = new win.AbortController();
      const timeout = win.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await win.fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('Account unavailable');
        const data = await response.json();
        if (!data.ok) throw Error('Account unavailable');
        if (request !== sequence) return state();
        userId = data.user?.mode !== 'local-owner' ? data.user?.id || null : null;
        revision = data.user?.uiLanguageRevision || 0;
        preference = userId && valid(data.user.uiLanguage) ? data.user.uiLanguage : guestPreference();
        loaded = true; announce(); return state();
      } finally { win.clearTimeout(timeout); }
    }
    async function save(value) {
      if (!valid(value) || saving) throw Error('Invalid preference');
      // Re-read identity before writing: never persist an unknown account's preference as a guest.
      await refresh();
      if (saving) throw Error('Preference save in progress');
      saving = true; sequence++;
      try {
        if (userId) {
          const controller = new win.AbortController();
          const timeout = win.setTimeout(() => controller.abort(), 10000);
          try {
            const response = await win.fetch('/api/auth/ui-language', {
              method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
              headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: value, revision }),
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw Object.assign(Error(data.error || 'Preference not saved'), { code: data.code });
            revision = data.revision;
          } finally { win.clearTimeout(timeout); }
        } else {
          const shared = ['evoronai.com', 'write.evoronai.com'].includes(win.location.hostname);
          win.document.cookie = cookieName + '=' + value + '; Path=/; Max-Age=31536000; SameSite=Lax' + (shared ? '; Domain=evoronai.com' : '') + (win.location.protocol === 'https:' ? '; Secure' : '');
          if (guestPreference() !== value) throw Error('Browser preference storage unavailable');
        }
        preference = value; announce(); channel?.postMessage('changed'); return state();
      } finally { saving = false; }
    }
    win.addEventListener('languagechange', announce);
    if (channel) channel.onmessage = event => { if (event.data === 'changed') refresh().catch(() => {}); };
    win.addEventListener('focus', () => refresh().catch(() => {}));
    win.document.addEventListener('visibilitychange', () => {
      if (win.document.visibilityState === 'visible') refresh().catch(() => {});
    });
    return { state, refresh, save };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { resolve, create };
  else {
    if (root.EvoronLanguage) return;
    root.EvoronLanguage = create(root);
    root.EvoronLanguage.refresh().catch(() => {});
  }
})(typeof window === 'undefined' ? globalThis : window);

window.EvoronStoreLanguagePairs=[["设置","Settings"],["全部分类","All categories"],["清除筛选","Clear filters"],["章节最多","Most chapters"],["查看更多 · ","View more · "],["登录 / 注册","Sign in / Register"],["积分方案","Writing credits"],["书稿类别","Book type"],["全部类别","All types"],["非虚构","Nonfiction"],["虚构","Fiction"],["正文语言","Book language"],["全部语言","All languages"],["主题书单","Reading lists"],["没有匹配的作品，可以减少关键词或清除筛选。","No matching books. Try fewer keywords or clear the filters."],["推荐值","Recommend"],["读者评分","Reader rating"],["编辑评分","Editorial"],["人读过","readers"],[" 人读过"," read this"],[" 人在读"," reading now"],[" 人想读"," want to read"],["登录 EVORON AI电子书城","Sign in to EVORON AI Bookstore"],["EVORON AI电子书城","EVORON AI Bookstore"],["登录后写作与账号互通，点「写一本书」不用再登一次。","One account for reading and writing — no second sign-in at the studio."],["没有你要看的书？","Can’t find the book you want?"],["让 AI 写一本","Write one with AI"],["对话完成设定，引擎自动写作，完稿即可出版上架。","Plan by chat, the engine writes, publish when it’s done."],["开始写作","Start writing"],["我的书架","My shelf"],["我的主页","My page"],["搜索书名、作者、分类或标签","Search titles, authors, categories or tags"],["搜索书库","Search"],["热门分类","Popular categories"],["作者入口","For authors"],["请输入账号与密码","Enter your username and password"],["登录失败","Sign-in failed"],["登录名","username"],["账号","Account"],["密码","Password"],["登录后即可使用书架，把喜欢的书加进来。","Sign in to use your shelf and collect books you like."],["去登录","Sign in"],["登录","Sign in"],["最近加入书库的作品","Recently added"],["编辑精选","Editors’ picks"],["新书上架","New arrivals"],["编辑评审给分，共 ","Scored by editorial review · "],["最近 30 天上架中编辑评分领先的作品","Highest editorial scores among releases in the last 30 days"],["全馆编辑评分最高的作品","The highest editorial scores in the library"],["编辑评分 8.5 分以上的作品","Books with editorial scores of 8.5 and above"],["近期佳作","Recent highlights"],["编辑精选","Editorial picks"],["编辑评分 ","Editors’ score "],["编辑评分","Editorial score"],["全部作品","All books"],["作品分类","Categories"],["最新上架","Newest"],["评分最高","Top rated"],["篇幅最长","Longest"],["没有找到匹配的作品。","No matching books."],["已显示 ","Showing "],["继续下拉，还有 ","Keep scrolling — "],["推荐值 ","Rec "],["飙升榜","Trending"],["新书榜","New releases"],["总榜","Top rated"],["神作榜","Masterpieces"],["最近 30 天上架中评分领先的作品","Highest-rated among the last 30 days of releases"],["最近上架的新作品","The latest additions to the library"],["全馆读者与编辑评分最高的作品","The highest-rated books in the whole library"],["编辑评分 8.5 分以上的高分书","Books rated 8.5 and above by the editorial desk"],["同类好书","More like this"],["展开全部 ","Show all "],["神作","Masterpiece"],["好评如潮","Loved"],["值得一读","Worth a read"],["书库尚无公开作品。","No public books yet."],["暂无公开作品。","No public books yet."],["+' 部')","+' books')"],["个人主页","My page"],["进入写作台","Open the studio"],["登出","Sign out"],[" · 超级用户"," · Owner"],["剩余积分 ","Remaining credits: "],["积分 ","Credits: "],["推荐阅读","For you"],["探索主题","Explore topics"],["为你推荐","For you"],["推荐值 ","Recommendation "],["按你的阅读口味挑选","Picked for your taste"],["按评分与新度挑选","By rating and freshness"],["分类","Categories"],["查看全部 · ","View all · "],["查看全部","View all"],[" 个分类"," categories"],[" 本书籍"," books"],["书库","Library"],["社区动态","Community"],["正在打开书架…","Opening your shelf…"],["书架还是空的——去书库把喜欢的书加进来（封面页有「想读」按钮）。","Your shelf is empty — add books from the library (use “Want to read” on a cover page)."],["书架暂时打不开。","Shelf temporarily unavailable."],["读到第 ","At ch. "],["刚开始读","Just started"],["✓ 标记读完","✓ Mark finished"],["已读完 ✓","Finished ✓"],["在读","Reading"],["想读","Want to read"],["读完","Finished"],["从 ","From "],[" 部作品里随机"," books at random"],[" 部公开作品 · "," public books · "],[" 部公开作品"," public books"],["每一本都由 AI 倾力写成","Every book crafted end-to-end by AI"],["查看全部 ›","View all ›"],["书友划线","Reader underlines"],["来自读者的真实划线与想法","Real underlines and thoughts from readers"],["阅读无需登录","Reading needs no sign-in"],["阅读无需","No sign-in needed to read"],["由管理员发放，用于写书与发布","issued by the admin, for writing and publishing"],["加入书架","Add to shelf"],["书架","Library"],["尚未完成编辑评测","Not yet editorially reviewed"],["编辑评分，满分 10 分","Editorial score, out of 10"],["aria-label=\"书城视图\"","aria-label=\"Store view\""],["书城","Bookstore"],["换一批","Shuffle"],["榜单","Charts"],["搜索结果","Search results"],["清除搜索","Clear search"],["继续阅读 · 第 ","Continue · Ch. "],["继续阅读","Continue reading"],["开始阅读","Start reading"],["未署名","Anonymous"],[" 位作者"," authors"],["读到第 ","At ch. "],[" 部作品"," books"],["暂无内容简介。","No description yet."],["内容简介","About this book"],["目录","Contents"],[" 章 · "," · "],["共 ",""],["第 ","Ch. "],[" 章"," chapters"],["全部","All"],["游戏史","Gaming"],["科技史","Technology"],["科普","Popular Science"],["心理认知","Psychology"],["医学健康","Health & Medicine"],["自然博物","Nature"],["经济理财","Economics & Finance"],["商业管理","Business & Management"],["个人成长","Personal Growth"],["中国史","Chinese History"],["人物传记","Biography"],["世界史","World History"],["文化史","Culture"],["商业史","Business"],["战争史","War"],["小说","Fiction"],["经济史","Economics"],["历史","History"],["中文","Chinese"],["href=\"index-en.html\"","href=\"index.html\""],["'hai.shelfLang','en'","'hai.shelfLang','zh'"]];
'use strict';
/* global window, document, MutationObserver */
(function () {
  if (window.__evoronStoreLanguageInstalled) return;
  window.__evoronStoreLanguageInstalled = true;
  const pairs = [...window.EvoronStoreLanguagePairs, ...Object.entries({
    'EVORON AI电子书城': 'EVORON AI Library',
    '内容简介': 'About this book', '展开简介': 'Read more', '收起简介': 'Show less',
    '收起目录': 'Show fewer chapters', '热门划线': 'Popular highlights',
    '精彩点评': 'Top reviews', 'AI 编辑点评': 'AI editorial review',
    '读完这本书，写下你的点评 →': 'Finish the book to add yours →',
    '+ 想读': '+ Want to read', '这本书怎么样？': 'Rate this book:',
    '👍 推荐': '👍 Recommend', '😐 一般': '😐 So-so', '👎 不行': '👎 Not for me',
    '已记录 ✓': 'Saved ✓', '阅读无需登录。': 'You can read without signing in.',
    '登录后加入书架': 'Sign in to add to shelf', '重试': 'Retry',
    '正在保存…': 'Saving…', '已保存': 'Saved',
    '书架暂时不可用，未更改原状态。': 'Shelf unavailable. Your previous state is unchanged.',
    '时间线': 'Timeline', '人物与地名表': 'People & places',
    '还没有读者评分——读完这本书的人可以在末章打分。': 'No reader ratings yet — finish the book to be the first.',
    '设置': 'Settings', '通用设置': 'General settings', '我的主页': 'My page',
    '账号与邮箱': 'Account & email', '账号安全': 'Security', '积分与购买记录': 'Credits & orders',
    '联系支持': 'Contact support', '退出登录': 'Sign out', '登录 / 注册': 'Sign in / Register',
    '账号菜单': 'Account menu', '账号管理': 'Account management',
    '开始写作': 'Start writing', '积分方案': 'Writing credits', '关于我们': 'About us',
    '书城': 'Bookstore', '书城首页': 'Bookstore', '我的书架': 'My shelf', '社区动态': 'Community',
    '书架': 'Shelf', '动态': 'Community', '我的': 'Me', '笔记本': 'Notebook',
    '在读': 'Reading', '想读': 'Want to read', '读完': 'Finished', '全部作品': 'All books',
    '作品类型': 'Work type', '正文语言': 'Book language', '全部类型': 'All types',
    '全部语言': 'All languages', '非虚构': 'Nonfiction', '小说': 'Fiction',
    '搜索书名、作者、分类或标签': 'Search titles, authors, categories or tags',
    '编辑评分': 'Editorial score', '编辑评分，满分 10 分': 'Editorial score, out of 10',
    '正在读取书架…': 'Loading shelf…', '重新读取账号': 'Retry account',
    '认识 EvoronAI': 'Meet EvoronAI', '继续阅读': 'Continue reading',
    '发现下一本好书': 'Discover your next read', '浏览书库': 'Browse books', '筛选': 'Filters',
  })];
  const forward = new Map(pairs.map(([a, b]) => [a.trim(), b.trim()]));
  const reverse = new Map(pairs.map(([a, b]) => [b.trim(), a.trim()]));
  const originals = new WeakMap();
  const detailSurfaces = ',.book-main .meta,.reader-rating-empty,.rr-count,.rr-notes,.hl-item small,.browse-filters summary';
  const surfaces = '.sitebar,.description h2,.editor-review h2,.hot-lines h2,.hot-reviews h2,.rv-more,.disclosure-toggle,.book-topics,.chapter-row>span:first-child,.social-stats,.topbar,.m-tabbar,.sec-head,.search-head,.home-tabs,.toolbar,.discovery-filters,.sortseg,.board header,.theme-group h4,.shelf-more,.reco-line,.readers-badge,.cover-hover .start-btn,.shelf-tabs,.shelf-filters,.card .acts,.page-head,.account-overview nav,.book-controls,.stat-cell span,.catalog-head,.store-account-entry,.category-cloud,.catbar,.hot,.foot-brand,.footer [data-store-about],.store-welcome-reopen,[data-continue-label],[data-continue-progress]';
  const excluded = '[translate="no"],textarea,[contenteditable],.book-card h2,.card-author,.cover-art,.book-main h1,.subtitle,.quote-text,.nb-quote,.nb-text';
  let language = window.EvoronLanguage.state().language;
  function translate(node, key, value) {
    if (!value.trim()) return value;
    const record = originals.get(node) || {};
    const previous = record[key];
    const source = previous?.output === value ? previous.source : value;
    const chinese = (reverse.get(source.trim()) || source.trim()).replace(/^(?:At ch\.|Chapter) (\d+) · (\d+)%$/, '读到第 $1 章 · $2%').replace(/^Continue chapter (\d+)$/, '继续第 $1 章');
    let translated = language === 'en' ? forward.get(chinese) || chinese : chinese;
    const patterns = [
      [/^第 (\d+) 章$/, 'Chapter $1', /^Chapter (\d+)$/, '第 $1 章'],
      [/^共 (\d+) 章$/, '$1 chapters', /^(\d+) chapters$/, '共 $1 章'],
      [/^查看全部 (\d+) 章$/, 'View all $1 chapters', /^View all (\d+) chapters$/, '查看全部 $1 章'],
      [/^第 (\d+) 章$/, 'Ch. $1', /^Ch\. (\d+)$/, '第 $1 章'],
      [/^([\d,]+) 字$/, '$1 characters', /^([\d,]+) characters$/, '$1 字'],
      [/^([\d,]+) 词$/, '$1 words', /^([\d,]+) words$/, '$1 词'],
      [/^读者想法 (\d+) 条$/, 'Reader thoughts: $1', /^Reader thoughts: (\d+)$/, '读者想法 $1 条'],
    ];
    for (const [zh, enText, en, zhText] of patterns) translated = translated.replace(language === 'en' ? zh : en, language === 'en' ? enText : zhText);
    if (language === 'en') translated = translated.replace(/(\d+) 人点评/g, '$1 ratings').replace('样本较少', 'few ratings so far').replace(/(\d+) 人划线/g, '$1 readers underlined').replace(/(\d+) 赞/g, '$1 likes');
    else translated = translated.replace(/(\d+) ratings/g, '$1 人点评').replace('few ratings so far', '样本较少').replace(/(\d+) readers? underlined/g, '$1 人划线').replace(/(\d+) likes/g, '$1 赞');
    if (chinese === '人在读' || chinese === 'reading now') translated = language === 'en' ? 'reading now' : '人在读';
    if (chinese === '人想读' || chinese === 'want to read') translated = language === 'en' ? 'want to read' : '人想读';
    if (language === 'zh') translated = translated.replace(/^Showing (\d+) of (\d+) books$/, '共 $2 部作品 · 已显示 $1 部');
    if (language === 'en') translated = translated.replace(/^共 (\d+) 部作品 · 已显示 (\d+) 部$/, 'Showing $2 of $1 books');
    if (language === 'en') translated = translated.replace(/^读到第 (\d+) 章 · (\d+)%$/, 'Chapter $1 · $2%');
    if (language === 'en') translated = translated.replace(/^继续第 (\d+) 章$/, 'Continue chapter $1');
    if (language === 'en') translated = translated.replace(/^([\d,]+\s*\/\s*[\d,]+) 部作品$/, '$1 books').replace(/^([\d,]+) 本书籍$/, '$1 books').replace(/^([\d,]+) 人在读$/, '$1 reading now').replace(/^([\d,]+) 人读过$/, '$1 readers').replace(/^查看全部 · ([\d,]+) 个分类$/, 'View all · $1 categories');
    const output = source.replace(source.trim(), translated);
    record[key] = { source, output }; originals.set(node, record);
    return output;
  }
  function walk(node) {
    const parent = node.nodeType === 1 ? node : node.parentElement;
    if (!parent || parent.closest(excluded) || /^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName)) return;
    if (node.nodeType === 3) {
      if (parent.closest(surfaces + detailSurfaces + ',.browse-controls')) {
        const text = translate(node, 'text', node.nodeValue);
        if (text !== node.nodeValue) node.nodeValue = text;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.closest(surfaces + detailSurfaces + ',.browse-controls')) for (const key of ['title', 'aria-label', 'placeholder']) {
      const value = node.getAttribute(key);
      if (!value) continue;
      const text = translate(node, key, value);
      if (text !== value) node.setAttribute(key, text);
    }
    for (const child of node.childNodes) walk(child);
  }
  function paint() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    walk(document.body);
    document.querySelectorAll('[data-account-label="pricing"],[data-store-about]').forEach(link => {
      link.href = '/' + (link.hasAttribute('data-store-about') ? 'about' : 'pricing') + (language === 'en' ? '-en' : '') + '.html';
    });
  }
  window.addEventListener('evoron:language', event => { language = event.detail.language; paint(); });
  paint();
  new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'childList') change.addedNodes.forEach(walk);
      else walk(change.target);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
})();

// 书籍详情页的页内逻辑。issue #5 之前这些是六段内联 <script>，严格 script-src 会
// 全部拦下；现在逻辑在这里，per-book 数据从页面上的
// <script type="application/json" id="evoron-book-data"> 读进来（JSON 块不执行，
// CSP 不拦它）。行为与内联版逐段等价，只是执行时机统一挪到 </main> 之后。
(function () {
  var node = document.getElementById('evoron-book-data');
  if (!node) return;
  var D;
  try { D = JSON.parse(node.textContent); } catch (e) { return; }
  var labels = {
    continueChapter: ['继续第 {n} 章', 'Continue chapter {n}'],
    underlinedOne: [' 人划线', ' reader underlined'], underlinedMany: [' 人划线', ' readers underlined'],
    likes: [' 赞', ' likes'], reader: ['读者', 'Reader'],
    signInToRate: ['回书库登录后即可评价', 'Sign in from the library to rate'],
    ratings: [' 人点评', ' ratings'], lowSample: [' · 样本较少', ' · few ratings so far'],
    notesPrefix: ['读者想法 ', 'Reader thoughts: '], notesSuffix: [' 条', ''],
  };
  var T = {};
  Object.keys(labels).forEach(function (key) {
    Object.defineProperty(T, key, { get: function () { return labels[key][window.EvoronLanguage.state().language === 'en' ? 1 : 0]; } });
  });
  var bid = D.projectId || '';

  // 书架按钮（原 reader-shelf.js 之后的一行内联调用）
  if (window.EvoronShelf && D.shelf) {
    try { EvoronShelf.installDetail(window, D.shelf); } catch (e) {}
  }

  // 继续阅读：把「开始阅读」换成上次读到的章
  (function () {
    var button = document.querySelector('[data-continue-reading]');
    if (!button || !D.continue || !window.EvoronDiscovery) return;
    try {
      var state = JSON.parse(localStorage.getItem(D.storageKey) || '{}');
      if (state && (!state.releaseId || state.releaseId === D.releaseId)
        && Number.isInteger(state.chapter) && state.chapter >= 0 && state.chapter < D.chapterCount) {
        button.href = EvoronDiscovery.continueHref(D.continue, state);
        button.textContent = String(T.continueChapter || '').replace('{n}', state.chapter + 1);
      }
    } catch (e) {}
  })();

  // 人气行：读过进数据栏大数字，在读/想读留小字行
  (function () {
    var box = document.querySelector('[data-social-stats]');
    if (!box || !bid) return;
    fetch('/api/social/book-stats?ids=' + encodeURIComponent(bid)).then(function (r) { return r.json(); }).then(function (d) {
      if (!(d && d.ok && d.stats && d.stats[bid])) return;
      var s = d.stats[bid];
      if (!(s.read || s.reading || s.wishlist)) return;
      if (s.read) {
        var rd = document.querySelector('[data-stat-readers]');
        if (rd) { rd.querySelector('[data-stat-readers-val]').textContent = s.read; rd.hidden = false; }
      }
      var parts = [];
      if (s.reading) parts.push('<span><strong>' + s.reading + '</strong> 人在读</span>');
      if (s.wishlist) parts.push('<span><strong>' + s.wishlist + '</strong> 人想读</span>');
      if (parts.length) { box.innerHTML = parts.join(''); box.hidden = false; }
    }).catch(function () {});
  })();

  // 读者评分：平均分、星条、分布、推荐值
  (function () {
    if (!bid) return;
    fetch('/api/book/stats?bookId=' + encodeURIComponent(bid)).then(function (r) { return r.json(); }).then(function (d) {
      if (!(d && d.ok)) return;
      var box = document.querySelector('[data-reader-rating]');
      var empty = document.querySelector('[data-reader-rating-empty]');
      if (!box) return;
      if (!d.count) { if (empty) empty.hidden = false; return; }
      box.hidden = false;
      box.querySelector('[data-rr-avg]').textContent = d.avg;
      var full = Math.round(d.avg);
      box.querySelector('[data-rr-stars]').textContent = '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
      box.querySelector('[data-rr-count]').textContent = ' · ' + d.count + (T.ratings || '') + (d.lowSample ? (T.lowSample || '') : '');
      var rrCell = document.querySelector('[data-stat-rr]');
      if (rrCell) { rrCell.querySelector('[data-stat-rr-val]').textContent = d.avg; rrCell.hidden = false; }
      // 推荐值只在样本够时出：少样本如实标注，不拿一两票算百分比
      if (d.count >= (d.sampleLimit || 5) && Array.isArray(d.dist)) {
        var rec = Math.round((d.dist[3] + d.dist[4]) / d.count * 100);
        var rcCell = document.querySelector('[data-stat-reco]');
        if (rcCell) { rcCell.querySelector('[data-stat-reco-val]').textContent = rec; rcCell.hidden = false; }
      }
      var bars = box.querySelector('[data-rr-bars]');
      var max = Math.max.apply(null, d.dist.concat([1]));
      for (var i = 4; i >= 0; i--) {
        var row = document.createElement('div'); row.className = 'rr-row';
        var lab = document.createElement('span'); lab.textContent = (i + 1) + '★';
        var bar = document.createElement('i'); var fill = document.createElement('b');
        fill.style.width = Math.round(d.dist[i] / max * 100) + '%';
        bar.appendChild(fill);
        var num = document.createElement('em'); num.textContent = d.dist[i];
        row.appendChild(lab); row.appendChild(bar); row.appendChild(num);
        bars.appendChild(row);
      }
      if (d.notes) document.querySelector('[data-rr-notes]').textContent = (T.notesPrefix || '') + d.notes + (T.notesSuffix || '');
    }).catch(function () {});
  })();

  // 热门划线 + 精彩点评 + 三键快捷评分
  (function () {
    if (!bid) return;
    fetch('/api/book/notes?bookId=' + encodeURIComponent(bid)).then(function (r) { return r.json(); }).then(function (d) {
      if (!(d && d.ok && d.notes && d.notes.length)) return;
      var byQ = {};
      d.notes.forEach(function (n) {
        if (!n.quote) return;
        var g = byQ[n.quote] = byQ[n.quote] || { q: n.quote, n: 0, likes: 0 };
        g.n++; g.likes += Number(n.likeCount) || 0;
      });
      var groups = Object.keys(byQ).map(function (k) { return byQ[k]; });
      groups.sort(function (a, b) { return (b.n * 2 + b.likes) - (a.n * 2 + a.likes); });
      var top = groups.slice(0, 4);
      if (!top.length) return;
      var list = document.querySelector('[data-hl-list]');
      top.forEach(function (g) {
        var it = document.createElement('div'); it.className = 'hl-item';
        it.appendChild(document.createTextNode(g.q));
        var s = document.createElement('small');
        s.textContent = g.n + (g.n > 1 ? (T.underlinedMany || '') : (T.underlinedOne || ''))
          + (g.likes ? (' · ' + g.likes + (T.likes || '')) : '');
        it.appendChild(s); list.appendChild(it);
      });
      document.querySelector('[data-hot-lines]').hidden = false;
    }).catch(function () {});

    fetch('/api/book/reviews?bookId=' + encodeURIComponent(bid)).then(function (r) { return r.json(); }).then(function (d) {
      if (!(d && d.ok && d.reviews)) return;
      var rows = d.reviews.filter(function (r2) { return r2.text; })
        .sort(function (a, b) { return (Number(b.likeCount) || 0) - (Number(a.likeCount) || 0); }).slice(0, 3);
      if (!rows.length) return;
      var list = document.querySelector('[data-rv-list]');
      rows.forEach(function (r2) {
        var it = document.createElement('div'); it.className = 'rv-item';
        var hd = document.createElement('div'); hd.className = 'rv-head';
        var av = document.createElement('span'); av.className = 'rv-ava'; av.textContent = String(r2.name || '?').slice(0, 1);
        var nm = document.createElement('b'); nm.textContent = r2.name || T.reader || '';
        var st = document.createElement('span'); st.className = 'rv-stars';
        st.textContent = '★★★★★'.slice(0, Math.max(1, Math.min(5, r2.rating || 0)));
        hd.appendChild(av); hd.appendChild(nm); hd.appendChild(st);
        if (Number(r2.likeCount)) {
          var lk = document.createElement('span'); lk.className = 'rv-like';
          lk.textContent = '♥ ' + r2.likeCount; hd.appendChild(lk);
        }
        it.appendChild(hd);
        var tx = document.createElement('p'); tx.className = 'rv-text'; tx.textContent = r2.text;
        it.appendChild(tx); list.appendChild(it);
      });
      document.querySelector('[data-hot-reviews]').hidden = false;
    }).catch(function () {});

    // 三键快捷评分（推荐/一般/不行）映射 5/3/1 星，走既有书评体系
    var qr = document.querySelector('[data-quick-rate]');
    if (!qr) return;
    var qbtns = [].slice.call(qr.querySelectorAll('[data-qr]'));
    function paintQr(rating) {
      var key = rating >= 4 ? '5' : (rating === 3 ? '3' : (rating >= 1 ? '1' : ''));
      qbtns.forEach(function (b) { b.classList.toggle('on', b.dataset.qr === key); });
    }
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (me) {
      if (!(me && me.ok && me.user)) return;
      fetch('/api/book/reviews?bookId=' + encodeURIComponent(bid), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (!(d && d.ok)) return;
          var mine = (d.reviews || []).filter(function (x) { return x.uid === me.user.id; })[0];
          if (mine) paintQr(Number(mine.rating) || 0);
        }).catch(function () {});
    }).catch(function () {});
    qbtns.forEach(function (b) {
      b.addEventListener('click', function () {
        fetch('/api/book/reviews', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: bid, rating: Number(b.dataset.qr) }),
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.ok) {
            paintQr(Number(b.dataset.qr));
            var dn = document.querySelector('[data-qr-done]');
            if (dn) { dn.hidden = false; setTimeout(function () { dn.hidden = true; }, 2200); }
          } else alert(T.signInToRate || '');
        }).catch(function () {});
      });
    });
  })();

  // 同类好书：静态卡片已渲染就直接显示，否则从书目索引兜底挑 6 本
  (function () {
    var box = document.querySelector('[data-related]');
    var grid = document.querySelector('[data-related-grid]');
    if (!box || !grid) return;
    if (grid.children.length) { box.hidden = false; return; }
    var self = D.projectId || '';
    var cat = D.category || '';
    fetch('/books/index.json').then(function (r) { return r.json(); }).then(function (rows) {
      if (!Array.isArray(rows)) return;
      var pool = rows.filter(function (r) {
        return r && r.projectId !== self && String(r.visibility || 'public') === 'public' && (!cat || r.category === cat);
      });
      if (pool.length < 3) {
        pool = rows.filter(function (r) { return r && r.projectId !== self && String(r.visibility || 'public') === 'public'; });
      }
      pool.sort(function (a, b) {
        return (Number(b.editorialScore && b.editorialScore.score) || 0) - (Number(a.editorialScore && a.editorialScore.score) || 0);
      });
      var pick = pool.slice(0, 6);
      if (!pick.length) return;
      grid.innerHTML = pick.map(function (r) {
        var sc = Number(r.editorialScore && r.editorialScore.score) || 0;
        var chip = sc ? '<span class="score-chip">' + (sc / 10).toFixed(1) + '</span>' : '';
        var cover = r.coverUrl ? '<img src="/' + String(r.coverUrl).replace(/^\//, '') + '" alt="" loading="lazy">' : '';
        return '<a class="rel-card" href="/' + String(r.url || '#').replace(/^\//, '') + '"><span class="rel-cover">'
          + cover + chip + '</span><strong>' + String(r.title || '').replace(/</g, '&lt;') + '</strong><small>'
          + String(r.authorDisplayName || '').replace(/</g, '&lt;') + '</small></a>';
      }).join('');
      box.hidden = false;
    }).catch(function () {});
  })();
})();
