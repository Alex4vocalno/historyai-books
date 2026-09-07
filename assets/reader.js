/* HistoryAI 公开站阅读器 —— 站点级共享资产（v4.60.0）
 *
 * 为什么是共享资产：此前阅读器外壳（顶栏、目录抽屉、设置面板、返回书库键）
 * 由发布链逐页烙进静态 HTML。任何外壳改动只对"改完之后重新发布过"的书生效，
 * 早发布的书永远停在旧外壳——用户实测指认「新书没有返回书库键、老书有」，
 * 根因即此（返回键 v4.59 才补，三本更早发布的书页面里压根没有这个节点）。
 * 现在外壳由本文件在运行时构建，全站共用一份；改外壳只需更新本文件。
 */
(function () {
  // v4.85 客户端段落精排 REFLOW_V2（与引擎 paragraph-reflow 同口径，改动须两侧同步）：
  // DP+词汇衔接度断段——句首话语标记/对话起手强断，相邻句字符重叠度低宜断、
  // 高不宜断；DP 全局求最优断点集。只动纯文本长段，句子切片重组必然无损。
  (function reflowParagraphs() {
    var root = document.querySelector('.reader-content');
    if (!root) return;
    var DIS_ZH = /^(然而|但|不过|于是|因此|所以|此后|随后|同时|与此同时|次年|同年|数年后|多年以后|几天后|第二天|首先|其次|再次|最后|总之|换言之|事实上|此外|另一方面|回到|再看|值得注意|更重要|问题在于|「|“)/;
    var DIS_EN = /^(However|But|Yet|Then|Moreover|Meanwhile|Later|Afterwards|First|Second|Finally|In fact|Instead|Nevertheless|On the other hand|")/i;
    function cjkLen(s) { return (s.match(/[一-鿿]/g) || []).length; }
    function wordLen(s) { return (s.match(/[A-Za-z][A-Za-z'-]*/g) || []).length; }
    function tokenSet(s, en) {
      var arr = en ? (s.toLowerCase().match(/[a-z]{3,}/g) || []) : (s.match(/[一-鿿]/g) || []);
      var set = {}; var size = 0;
      for (var i = 0; i < arr.length; i++) { if (!set[arr[i]]) { set[arr[i]] = 1; size++; } }
      return { set: set, size: size };
    }
    function overlap(a, b) {
      if (!a.size || !b.size) return 0;
      var inter = 0;
      for (var k in a.set) if (b.set[k]) inter++;
      return inter / Math.min(a.size, b.size);
    }
    var paras = Array.prototype.slice.call(root.querySelectorAll('p'));
    for (var pi = 0; pi < paras.length; pi++) {
      var p = paras[pi];
      if (p.children.length) continue;
      var t = p.textContent || '';
      var en = wordLen(t) > cjkLen(t) * 2;
      if (en ? wordLen(t) <= 150 : cjkLen(t) <= 250) continue;
      var re = en
        ? /[^.!?]*[.!?]+["')\]]*\s*|[^.!?]+$/g
        : /[^。！？；…]*[。！？；…]+[」』”’】)\]]*|[^。！？；…]+$/g;
      var sen = t.match(re) || [];
      if (sen.join('') !== t || sen.length < 3) continue;
      var n = sen.length;
      var len = en ? wordLen : cjkLen;
      var L = [], sets = [];
      for (var si = 0; si < n; si++) { L.push(len(sen[si])); sets.push(tokenSet(sen[si], en)); }
      var target = en ? 90 : 140, minLen = en ? 25 : 50, hardMax = en ? 150 : 240;
      var attract = [];
      for (var ai = 0; ai < n; ai++) attract.push(0);
      for (var bi = 0; bi < n - 1; bi++) {
        if ((en ? DIS_EN : DIS_ZH).test(sen[bi + 1].replace(/^\s+/, ''))) attract[bi] += 2.2;
        var ov = overlap(sets[bi], sets[bi + 1]);
        if (ov < 0.12) attract[bi] += 0.9;
        else if (ov > 0.35) attract[bi] -= 1.4;
      }
      var dp = [0], back = [0];
      for (var di = 1; di <= n; di++) { dp.push(Infinity); back.push(0); }
      for (var i2 = 1; i2 <= n; i2++) {
        var sum = 0;
        for (var j2 = i2; j2 >= 1; j2--) {
          sum += L[j2 - 1];
          if (sum > hardMax * 1.7 && j2 < i2) break;
          var cost = Math.pow((sum - target) / target, 2) * 2;
          if (sum < minLen) cost += 3;
          if (sum > hardMax) cost += 4 + (sum - hardMax) / target;
          var bonus = i2 < n ? attract[i2 - 1] * 0.8 : 0;
          var total = dp[j2 - 1] + cost - bonus;
          if (total < dp[i2]) { dp[i2] = total; back[i2] = j2 - 1; }
        }
      }
      var ends = [];
      var cur = n;
      while (cur > 0) { ends.push(cur); cur = back[cur]; }
      ends.reverse();
      if (ends.length < 2) continue;
      var chunks = [], st = 0, ok = true, joined = '';
      for (var ei = 0; ei < ends.length; ei++) {
        var piece = sen.slice(st, ends[ei]).join('');
        chunks.push(piece); joined += piece; st = ends[ei];
      }
      if (joined !== t) continue;
      var frag = document.createDocumentFragment();
      for (var ci = 0; ci < chunks.length; ci++) {
        var np = document.createElement('p');
        np.textContent = chunks[ci];
        frag.appendChild(np);
      }
      p.parentNode.replaceChild(frag, p);
    }
  })();
  var el = document.getElementById('reader-data');
  if (!el) return;
  var data = {};
  try { data = JSON.parse(el.textContent || '{}'); } catch (e) { return; }
  var L = data.links || {};
  var root = document.documentElement;
  var isChapter = data.kind === 'chapter';
  var chapterHref = function (i) { return String(L.chapterPattern || 'ch-{n}.html').replace('{n}', String(Number(i) + 1)); };

  function h(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- 外壳：进度条 / 顶栏 / 目录抽屉 / 设置面板 ----
  var titles = Array.isArray(data.chapterTitles) ? data.chapterTitles : [];
  var chapterLabel = data.lang === 'en' ? 'Chapter ' + (Number(data.chapter) + 1) : '第 ' + (Number(data.chapter) + 1) + ' 章';
  // v4.91 阅读器外壳英文（按书语言）：中文串零改动，EN 书渲染前过词表
  var SHELL_EN = [[' · 当前第 ',' · reading ch. '],['返回书库','Back to library'],['书库','Library'],['目录','Contents'],['阅读设置','Reading settings'],['翻页','Paging'],['滚动','Scroll'],['主题','Theme'],['纸色','Paper color'],['纸张','Paper'],['白色','White'],['羊皮纸','Sepia'],['护眼绿','Green'],['夜间','Night'],['字号','Font size'],['字体','Typeface'],['衬线','Serif'],['宋体','Serif'],['楷体','Kai'],['黑体','Sans'],['行距','Leading'],['紧凑','Tight'],['舒适','Cozy'],['宽松','Loose'],['版心','Width'],['窄','Narrow'],['中','Medium'],['宽','Wide'],['上一章','Previous'],['下一章','Next chapter'],[' 章',' chapters'],[' 页',' pages'],['设置','Settings']];
  function loc(html) {
    if (data.lang !== 'en') return html;
    var out = String(html);
    for (var li = 0; li < SHELL_EN.length; li++) out = out.split(SHELL_EN[li][0]).join(SHELL_EN[li][1]);
    return out;
  }
  var homeHref = L.home || '';
  var detailHref = L.detail || '';

  var progress = h('div', 'read-progress', '<span></span>');
  var tools = ''
    + '<button class="icon-button text" type="button" data-toggle-settings title="字体与排版">字体</button>'
    + (detailHref ? '<a class="icon-button text reader-secondary" href="' + esc(detailHref) + '" title="回到本书封面">封面</a>' : '')
    + loc('<a class="icon-button text" href="/shelf.html" title="我的书架">书架</a>')
    + (homeHref ? loc('<a class="icon-button text reader-secondary" href="' + esc(homeHref) + '" title="返回书库">书库</a>') : '');
  var bar = h('header', 'reader-bar', '<div class="reader-bar-inner">'
    + '<div class="reader-bar-left">'
    + (titles.length ? loc('<button class="icon-button text" type="button" data-toggle-drawer>目录</button>') : '')
    + '<a class="reader-book" href="' + esc(detailHref || homeHref || '#') + '"><strong>' + esc(data.title) + '</strong><small>' + esc(data.author || '未署名') + '</small></a>'
    + '</div>'
    + '<div class="reader-bar-center"><span class="reader-location">' + esc(isChapter ? chapterLabel + ' · ' + (data.chapterTitle || '') : '') + '</span></div>'
    + '<div class="reader-tools">' + tools + '</div>'
    + '</div>');

  var drawer = null;
  if (titles.length) {
    var rows = titles.map(function (t, i) {
      return '<a class="chapter-link' + (i === Number(data.chapter) ? ' active' : '') + '" href="' + esc(chapterHref(i)) + '">'
        + '<span>' + String(i + 1).padStart(2, '0') + '</span><span>' + esc(t) + '</span></a>';
    }).join('');
    drawer = h('aside', 'chapter-drawer', loc('<div class="drawer-head"><strong>目录</strong><span>' + titles.length + ' 章'
      + (isChapter ? ' · 当前第 ' + (Number(data.chapter) + 1) + ' 章' : '') + '</span></div><nav class="chapter-list">' + rows + '</nav>'
      + '<div class="bm-head">' + (data.lang === 'en' ? 'BOOKMARKS' : '书签') + '</div><div class="bm-list" data-bm-list><p class="bm-empty">' + (data.lang === 'en' ? 'Select text and tap Bookmark to save one.' : '选中正文点「书签」即可保存。') + '</p></div>'));
  }

  var settings = h('section', 'settings', loc('<strong>阅读设置</strong>'
    + '<div class="setting-row"><label>翻页</label><div class="segments"><button type="button" data-setting="mode" data-value="page">翻页</button><button type="button" data-setting="mode" data-value="scroll">滚动</button></div></div>'
    + '<div class="setting-row"><label>纸色</label><div class="swatches">'
    + '<button type="button" class="swatch" data-setting="theme" data-value="paper" title="纸张" aria-label="纸张" style="background:#f4f1e8"></button>'
    + '<button type="button" class="swatch" data-setting="theme" data-value="white" title="白色" aria-label="白色" style="background:#ffffff"></button>'
    + '<button type="button" class="swatch" data-setting="theme" data-value="sepia" title="羊皮纸" aria-label="羊皮纸" style="background:#eee1c6"></button>'
    + '<button type="button" class="swatch" data-setting="theme" data-value="green" title="护眼绿" aria-label="护眼绿" style="background:#d6e4d6"></button>'
    + '<button type="button" class="swatch" data-setting="theme" data-value="night" title="夜间" aria-label="夜间" style="background:#202527"></button>'
    + '</div></div>'
    + '<div class="setting-row"><label>字号</label><div class="stepper"><button type="button" data-font-step="-1">−</button><span data-font-value>18 px</span><button type="button" data-font-step="1">＋</button></div></div>'
    + '<div class="setting-row"><label>字体</label><div class="segments"><button type="button" data-setting="face" data-value="serif">宋体</button><button type="button" data-setting="face" data-value="kai">楷体</button><button type="button" data-setting="face" data-value="sans">黑体</button></div></div>'
    + '<div class="setting-row"><label>行距</label><div class="segments"><button type="button" data-setting="leading" data-value="1.75">紧凑</button><button type="button" data-setting="leading" data-value="2">舒适</button><button type="button" data-setting="leading" data-value="2.2">宽松</button></div></div>'
    + '<div class="setting-row"><label>版心</label><div class="segments"><button type="button" data-setting="width" data-value="680">窄</button><button type="button" data-setting="width" data-value="760">中</button><button type="button" data-setting="width" data-value="860">宽</button></div></div>'));
  settings.hidden = true;
  var mask = h('div', 'drawer-mask');

  var shell = document.querySelector('.reader-shell');
  document.body.insertBefore(progress, document.body.firstChild);
  document.body.insertBefore(bar, progress.nextSibling);
  if (drawer && shell) shell.insertBefore(drawer, shell.firstChild);
  document.body.appendChild(mask);
  document.body.appendChild(settings);

  var tocList = drawer ? drawer.querySelector('.chapter-list') : null;
  var tocKey = 'historyai.reader.toc.' + (data.bookId || data.title || 'book');
  function defer(fn) { if (window.requestAnimationFrame) requestAnimationFrame(fn); else setTimeout(fn, 0); }
  function saveTocScroll() {
    if (!tocList) return;
    try { sessionStorage.setItem(tocKey, JSON.stringify({ top: tocList.scrollTop, chapter: Number(data.chapter) || 0, at: Date.now() })); } catch (e) {}
  }
  function restoreTocScroll() {
    if (!tocList) return;
    var restored = false;
    try {
      var saved = JSON.parse(sessionStorage.getItem(tocKey) || 'null');
      if (saved && Date.now() - Number(saved.at || 0) < 30 * 60 * 1000 && Number.isFinite(Number(saved.top))) {
        tocList.scrollTop = Math.max(0, Number(saved.top) || 0);
        restored = true;
      }
    } catch (e) {}
    if (!restored) {
      var active = tocList.querySelector('.chapter-link.active');
      if (active) tocList.scrollTop = Math.max(0, active.offsetTop - Math.round(tocList.clientHeight * 0.42));
    }
  }
  if (tocList) {
    tocList.addEventListener('scroll', saveTocScroll, { passive: true });
    tocList.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a.chapter-link');
      if (link) saveTocScroll();
    });
    defer(restoreTocScroll);
  }

  // 底部章间导航（翻页模式下由 CSS 隐藏；滚动模式与无脚本回退时可用）
  var navHost = document.querySelector('[data-chapter-nav]');
  if (navHost && isChapter) {
    var prev = Number(data.chapter) > 0 ? loc('<a href="' + esc(chapterHref(Number(data.chapter) - 1)) + '">上一章</a>') : '<span></span>';
    var next = Number(data.chapter) + 1 < titles.length ? loc('<a href="' + esc(chapterHref(Number(data.chapter) + 1)) + '">下一章</a>') : '<span></span>';
    navHost.innerHTML = prev + '<span class="nav-home">'
      + (detailHref ? '<a href="' + esc(detailHref) + '">封面</a>' : '')
      + (homeHref ? '<a href="' + esc(homeHref) + '">书库</a>' : '')
      + '</span>' + next;
  }

  if (!isChapter) return; // 起始页只要外壳，不跑分页逻辑

  if (window.__haiReaderEntryRedirecting) return;

  // ---- 阅读行为：翻页排版 / 设置 / 进度记忆 ----
  // Panel history must not restore a pre-reflow scroll position over the text anchor.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var key = 'historyai.reader.' + data.bookId;
  var releaseId = data.releaseId || (location.pathname.split('/releases/')[1] || '').split('/')[0];
  var editionPolicy = (function readerEditionPolicy() {
  const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
  function releaseOf(record) {
    const id = record && (record.releaseId || record.anchor?.releaseId
      || String(record.href || '').split('/releases/')[1]?.split('/')[0]);
    return validId(id) ? id : '';
  }
  function chapterFor(record, releaseId, titles) {
    if (!record) return -1;
    const source = releaseOf(record);
    if (source && source !== releaseId) {
      if (!record.chapterTitle) return -1;
      const hits = titles.map((title, i) => title === record.chapterTitle ? i : -1).filter(i => i >= 0);
      return hits.length === 1 ? hits[0] : -1;
    }
    const index = Number(record.chapter);
    return Number.isInteger(index) && index >= 0 && index < titles.length ? index : -1;
  }
  const checkpointKey = (key, releaseId) => key.replace(/^historyai\.reader\./, 'historyai.reader-edition.') + '.' + releaseId;
  return { validId, releaseOf, chapterFor, checkpointKey };
})();
  var readerEdition = (function createReaderEdition({ storage, key, releaseId, policy }) {
  let raw = null, previous = {}, corrupt = false, readFailed = false;
  try {
    raw = storage.getItem(key);
  } catch { readFailed = true; }
  try {
    previous = raw ? JSON.parse(raw) : {};
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) corrupt = true;
  } catch { corrupt = true; }
  const source = policy.releaseOf(previous);
  const crossing = Boolean(source && source !== releaseId);
  let allowed = !crossing && !corrupt && !readFailed;
  let backedUp = false;
  function backup() {
    if (readFailed) return false;
    if (backedUp) return true;
    try {
      if (raw !== null) {
        const archiveKey = policy.checkpointKey(key, source || 'legacy');
        storage.setItem(archiveKey, raw);
        if (storage.getItem(archiveKey) !== raw) return false;
      }
      backedUp = true;
      return true;
    } catch { return false; }
  }
  let progress = allowed ? previous : {};
  if (crossing && backup()) {
    try {
      const saved = JSON.parse(storage.getItem(policy.checkpointKey(key, releaseId)) || 'null');
      if (saved && policy.releaseOf(saved) === releaseId) { progress = saved; allowed = true; }
    } catch { /* A damaged checkpoint must not replace the source record. */ }
  }
  return {
    previous: corrupt ? {} : previous, progress,
    needsRecovery: corrupt || readFailed,
    canSave: () => allowed,
    accept() { if (!backup()) return false; allowed = true; return true; },
  };
})({
    storage: { getItem: function (k) { return localStorage.getItem(k); }, setItem: function (k, v) { localStorage.setItem(k, v); } },
    key: key, releaseId: releaseId, policy: editionPolicy
  });
  var PREF_KEY = 'historyai.reader.settings';
  // v5.40 外观全局化（用户实弹：每次点阅读默认夜间）：外观（纸色/字体/字号/
  // 行距/版心/翻页）存全站 key，一次设定所有书生效；书级 key 只存进度。
  // 缺省一律纸张——不再跟随系统深色模式（v4.86 跟随逻辑就是夜间病灶）。
  var state = { theme: 'paper', face: 'serif', font: 18, leading: 2, width: 760, mode: 'page', chapter: 0, page: 0, href: '' };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* 首次阅读 */ }
  try {
    var prog0 = readerEdition.progress;
    // 老账迁移：手选过主题的读者把书级外观带进全站偏好（仅当全站偏好还没建立）
    if (prog0.themeChosen && !localStorage.getItem(PREF_KEY)) {
      ['theme', 'face', 'font', 'leading', 'width', 'mode'].forEach(function (k0) { if (prog0[k0] !== undefined) state[k0] = prog0[k0]; });
    }
    state.chapter = prog0.chapter || 0; state.page = prog0.page || 0; state.href = prog0.href || '';
    state.anchor = prog0.anchor || null; state.updatedAt = prog0.updatedAt || '';
  } catch (e) { /* 首次阅读 */ }
  if (state.mode !== 'scroll') state.mode = 'page';
  var flow = document.querySelector('.flow-inner');
  var paper = document.querySelector('.reader-paper');
  var flowBox = document.querySelector('.paper-flow');
  var page = 0, total = 1, step = 1, prefetched = false;
  var positionReady = false, readerSync = null, applyingSync = false, anchoredScrollY = null;
  var mayPrefetch = (function readerMayPrefetch(navigator, document) {
  if (document.visibilityState === 'hidden' || navigator.onLine === false) return false;
  const connection = navigator.connection;
  if (!connection) return true;
  return !connection.saveData && !['slow-2g', '2g', '3g'].includes(connection.effectiveType)
    && !(connection.downlink > 0 && connection.downlink < 1.5);
});
  var initialPosition = readerEdition.progress;
  var readerLocation = (function createReaderLocation({ document, window, content, flow, chapter, chapterTitle, releaseId }) {
  function textNodes(block) {
    const walker = document.createTreeWalker(block, 4);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement.closest('.idea-dot,.review-box')) nodes.push(node);
    }
    return nodes;
  }
  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16);
  }
  const blocks = content ? [...content.querySelectorAll('p,h2,h3,h4,li,pre')]
    .filter(block => !block.closest('.review-box') && !block.querySelector('p,li,pre')) : [];
  const entries = blocks.map(block => {
    const text = textNodes(block).map(node => node.nodeValue).join('');
    return { block, hash: fingerprint(text), length: text.length };
  });
  function resolve(anchor) {
    if (!anchor || anchor.version !== 1 || anchor.releaseId !== releaseId
      || anchor.chapter !== chapter || anchor.chapterTitle !== chapterTitle
      || !Number.isInteger(anchor.offset) || anchor.offset < 0) return null;
    const matches = entry => entry && entry.hash === anchor.hash && entry.length === anchor.length;
    let entry = entries[anchor.block];
    if (!matches(entry)) {
      const hits = entries.filter(matches);
      if (hits.length !== 1) return null;
      entry = hits[0];
    }
    return anchor.offset < entry.length ? entry : null;
  }
  function characterRect(entry, offset) {
    for (const node of textNodes(entry.block)) {
      if (offset < node.nodeValue.length) {
        const range = document.createRange();
        range.setStart(node, offset); range.setEnd(node, offset + 1);
        return range.getBoundingClientRect();
      }
      offset -= node.nodeValue.length;
    }
    return null;
  }
  const topEdge = () => Math.max(0, document.querySelector('.reader-bar')?.getBoundingClientRect().bottom || 0) + 8;
  const pageOf = (rect, step) => Math.max(0, Math.floor((rect.left - flow.getBoundingClientRect().left + 1) / step));
  function capture({ mode, page, step }) {
    const top = topEdge();
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (!entry.length) continue;
      const rects = [...entry.block.getClientRects()];
      const visible = rects.some(rect => mode === 'page' ? pageOf(rect, step) === page
        : rect.bottom > top && rect.top < window.innerHeight);
      if (!visible) continue;
      // Find the first visible character, including a paragraph split across columns.
      let lo = 0, hi = entry.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const rect = characterRect(entry, mid);
        if (!rect) return null;
        const before = mode === 'page' ? pageOf(rect, step) < page : rect.bottom <= top;
        if (before) lo = mid + 1; else hi = mid;
      }
      return { version: 1, releaseId, chapter, chapterTitle, block: index,
        hash: entry.hash, length: entry.length, offset: lo };
    }
    return null;
  }
  return {
    capture,
    migrate(anchor) {
      if (!anchor || anchor.version !== 1 || anchor.chapterTitle !== chapterTitle
        || !Number.isInteger(anchor.offset) || anchor.offset < 0) return null;
      const hits = entries.map((entry, index) => ({ ...entry, index }))
        .filter(entry => entry.hash === anchor.hash && entry.length === anchor.length && anchor.offset < entry.length);
      if (hits.length !== 1) return null;
      return { ...anchor, releaseId, chapter, block: hits[0].index };
    },
    pageFor(anchor, step) {
      const entry = resolve(anchor);
      const rect = entry && characterRect(entry, anchor.offset);
      return rect ? pageOf(rect, step) : null;
    },
    scrollTo(anchor) {
      const entry = resolve(anchor);
      const rect = entry && characterRect(entry, anchor.offset);
      if (!rect) return false;
      window.scrollBy({ top: rect.top - topEdge(), behavior: 'instant' });
      return true;
    },
  };
})({
    document: document, window: window, content: document.querySelector('.reader-content'), flow: flow,
    chapter: Number(data.chapter), chapterTitle: data.chapterTitle || '',
    releaseId: releaseId
  });
  var prevHref = Number(data.chapter) > 0 ? chapterHref(Number(data.chapter) - 1) : '';
  var nextHref = Number(data.chapter) + 1 < titles.length ? chapterHref(Number(data.chapter) + 1) : '';

  function save() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: state.theme, face: state.face, font: state.font, leading: state.leading, width: state.width, mode: state.mode })); } catch (e) { /* 隐私模式 */ }
    if (!positionReady || !readerEdition.canSave()) return;
    if (applyingSync) return;
    try { localStorage.setItem(key, JSON.stringify({ releaseId: releaseId, chapter: state.chapter, page: state.page, anchor: state.anchor, href: state.href, chapterTitle: state.chapterTitle, updatedAt: state.updatedAt, readerUserId: readerSync && readerSync.isReady() ? readerSync.userId() : initialPosition.readerUserId || '' })); } catch (e) { /* 隐私模式 */ }
    if (readerSync) readerSync.note(syncPosition());
  }
  function syncPosition() {
    return { releaseId: releaseId, chapter: Number(data.chapter) || 0, n: titles.length, page: Number(state.page) || 0,
      anchor: state.anchor || null, title: data.title || '', chapterTitle: data.chapterTitle || '' };
  }
  // v4.86/v6.4 阅读埋点：open/half/finish/paint 四事件，
  // 匿名 tid、sendBeacon 零阻塞、失败无感。数据落写作台 output/telemetry/。
  function track(ev, extra) {
    try {
      var tid = localStorage.getItem('historyai.tid');
      if (!tid) { tid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('historyai.tid', tid); }
      var segs = location.pathname.split('/');
      var bIdx = segs.indexOf('books');
      var mb = bIdx >= 0 ? segs[bIdx + 1] : '';
      var mrel = (bIdx >= 0 && segs[bIdx + 2] === 'releases') ? segs[bIdx + 3] : '';
      var payload = JSON.stringify(Object.assign({ e: ev, b: data.bookId || mb || '', rel: mrel || '', c: Number(data.chapter) || 0, n: (titles && titles.length) || 0, tid: tid }, extra || {}));
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } catch (e3) { /* 打点失败无感 */ }
  }
  var trackSent = {};
  function trackOnce(ev) { if (!trackSent[ev]) { trackSent[ev] = 1; track(ev); } }
  function setBar(r) {
    var s = document.querySelector('.read-progress span'); if (s) s.style.width = (Math.max(0, Math.min(1, r)) * 100) + '%';
    var pctNode = document.querySelector('[data-reader-pct]');
    if (pctNode) pctNode.textContent = Math.round(Math.max(0, Math.min(1, r)) * 100) + '%';
    if (r >= 0.5) trackOnce('half');
    if (r >= 0.9 && nextHref && !prefetched && mayPrefetch(navigator, document)) {
      prefetched = true;
      var pl = document.createElement('link'); pl.rel = 'prefetch'; pl.href = nextHref; document.head.appendChild(pl);
    }
    if (r >= 0.98) {
      trackOnce('finish');
      // v5.12 读完自动标记（用户定调对齐微信读书）：末章读完即记书架「读完」
      if (!nextHref && readerSync && readerSync.isReady() && readerEdition.canSave() && !applyingSync && !window.__haiMarkedFinished) {
        window.__haiMarkedFinished = true;
        fetch('/api/reader/shelf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: data.bookId, title: data.title || '', status: 'finished', syncUserId: readerSync.userId() }) }).then(function (r) { return r.json(); }).then(function (result) {
          if (!result.ok) { window.__haiMarkedFinished = false; return; }
          var mk = document.querySelector('[data-mark-finished]');
          if (mk) { mk.textContent = data.lang === 'en' ? '✓ Finished' : '✓ 已读完'; mk.disabled = true; }
        }).catch(function () {});
      }
    }
  }
  var chapterChars = (function () {
    var rc = document.querySelector('.reader-content');
    var txt = rc ? (rc.textContent || '') : '';
    var cjkN = (txt.match(/[一-鿿]/g) || []).length;
    var wordsN = (txt.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
    return cjkN > wordsN ? { n: cjkN, per: 500, en: false } : { n: wordsN, per: 220, en: true };
  })();
  function remainText(r) {
    var mins = Math.ceil(chapterChars.n * (1 - Math.max(0, Math.min(1, r))) / chapterChars.per);
    if (mins <= 0) return chapterChars.en ? 'chapter end' : '本章读完';
    return chapterChars.en ? ('~' + mins + ' min left') : ('本章剩约 ' + mins + ' 分钟');
  }
  function indicator() {
    var el2 = document.querySelector('.page-indicator'); if (el2) el2.textContent = (page + 1) + ' / ' + total + (data.lang === 'en' ? ' pages · ' : ' 页 · ') + remainText(total > 1 ? page / (total - 1) : 1);
    var loc = document.querySelector('.reader-location');
    if (loc && state.mode === 'page') loc.textContent = chapterLabel + ' · ' + (data.chapterTitle || '') + ' · ' + (page + 1) + '/' + total + (data.lang === 'en' ? ' pages' : ' 页');
  }
  function layout(keepRatio) {
    var anchor = keepRatio ? state.anchor : null;
    root.dataset.rmode = state.mode;
    if (state.mode !== 'page') {
      if (flow) { flow.style.columnWidth = ''; flow.style.columnGap = ''; flow.style.transform = ''; flow.style.height = ''; }
      if (anchor) restoreScrollAnchor(anchor);
      scrollProgress(); return;
    }
    if (!flow || !flowBox) return;
    var ratio = total > 1 ? page / (total - 1) : 0;
    var cw = flowBox.clientWidth, gap = 48;
    // v5.73 手机端专项（用户实弹：首行文字有几率看不全、底部反而留白）：
    // 多列横排的列高若不是行高整倍数，跨列的行会被容器上缘腰斩——
    // 列高向下取整到行高整倍数，余量留给底部，行永远完整。
    var lh = parseFloat(getComputedStyle(flow).lineHeight);
    if (!isFinite(lh) || lh <= 0) lh = 28;
    var wholeH = Math.max(lh * 4, Math.floor(flowBox.clientHeight / lh) * lh);
    flow.style.height = wholeH + 'px';
    flow.style.columnWidth = cw + 'px'; flow.style.columnGap = gap + 'px';
    step = cw + gap;
    total = Math.max(1, Math.round((flow.scrollWidth + gap) / step));
    var anchoredPage = anchor && readerLocation.pageFor(anchor, step);
    go(anchoredPage != null ? anchoredPage : keepRatio ? Math.round(ratio * (total - 1)) : Math.min(page, total - 1), Boolean(anchor && anchoredPage != null));
  }
  function go(n, preserveAnchor) {
    page = Math.max(0, Math.min(total - 1, n));
    if (flow) flow.style.transform = 'translate3d(-' + (page * step) + 'px,0,0)';
    setBar(total > 1 ? page / (total - 1) : 1); indicator(); state.page = page;
    if (positionReady) {
      if (!preserveAnchor) state.anchor = readerLocation.capture({ mode: 'page', page: page, step: step });
      state.updatedAt = new Date().toISOString(); save();
    }
    var sl = document.querySelector('[data-reader-slider]');
    if (sl) { sl.max = String(Math.max(0, total - 1)); sl.value = String(page); }
  }
  function flip(dir, fromGesture) {
    if (state.mode !== 'page') { scrollBy({ top: dir * (innerHeight * 0.88), behavior: 'smooth' }); return; }
    // v5.87 沉浸阅读（微信读书向）：手势翻页即收起顶栏与底坞，中区轻点唤回
    if (fromGesture) document.body.classList.add('chrome-hidden');
    var n = page + dir;
    if (n < 0) { if (prevHref) location.href = prevHref + '#last'; return; }
    if (n > total - 1) { if (nextHref) location.href = nextHref; return; }
    go(n);
  }
  (function floatingReaderDock() {
    var prevText = data.lang === 'en' ? 'Prev' : '上一页';
    var nextText = data.lang === 'en' ? 'Next' : '下一页';
    var dock = h('div', 'reader-floating', '<button type="button" data-reader-prev>' + prevText + '</button><input type="range" data-reader-slider min="0" max="0" step="1" value="0" aria-label="' + (data.lang === 'en' ? 'Chapter progress' : '章内进度') + '"><span data-reader-pct>0%</span><button type="button" data-reader-next>' + nextText + '</button>');
    document.body.appendChild(dock);
    dock.querySelector('[data-reader-prev]').addEventListener('click', function (e) { e.stopPropagation(); flip(-1); });
    dock.querySelector('[data-reader-next]').addEventListener('click', function (e) { e.stopPropagation(); flip(1); });
    // v5.87 章内进度拖拽（微信读书向）：拖到哪页翻到哪页
    var slider = dock.querySelector('[data-reader-slider]');
    if (slider) slider.addEventListener('input', function (e) { e.stopPropagation(); go(Number(slider.value) || 0); });
  })();
  function apply() {
    root.dataset.theme = state.theme;
    root.dataset.face = state.face === 'sans' ? 'sans' : state.face === 'kai' ? 'kai' : 'serif';
    root.style.setProperty('--reader-font', state.font + 'px');
    root.style.setProperty('--reader-leading', state.leading);
    root.style.setProperty('--reader-width', state.width + 'px');
    document.querySelectorAll('[data-setting]').forEach(function (b) { b.classList.toggle('active', String(state[b.dataset.setting]) === b.dataset.value); });
    var f = document.querySelector('[data-font-value]'); if (f) f.textContent = state.font + ' px';
  }
  function restoreScrollAnchor(anchor) {
    if (!readerLocation.scrollTo(anchor)) return false;
    anchoredScrollY = scrollY;
    return true;
  }
  function scrollProgress() {
    if (state.mode === 'page') return;
    var totalH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var r = scrollY / totalH;
    setBar(r);
    // v5.25 阅读体验深化：滚动模式同样显示本章剩余时间（此前只有翻页模式有）
    var loc2 = document.querySelector('.reader-location');
    if (loc2) loc2.textContent = chapterLabel + ' · ' + (data.chapterTitle || '') + ' · ' + remainText(r);
    if (positionReady) {
      // Programmatic reflow can round a text position to a different line in WebKit.
      if (!state.anchor || anchoredScrollY === null || Math.abs(scrollY - anchoredScrollY) > 1) {
        state.anchor = readerLocation.capture({ mode: 'scroll', page: page, step: step });
        anchoredScrollY = null;
      }
      state.updatedAt = new Date().toISOString(); save();
    }
  }

  var sameChapter = Number(state.chapter) === Number(data.chapter);
  var savedPage = sameChapter ? Number(state.page) || 0 : 0;
  var savedAnchor = sameChapter ? state.anchor : null;
  state.anchor = savedAnchor;
  state.chapter = Number(data.chapter);
  state.href = new URL(L.self || location.pathname.split('/').pop(), location.href).href;
  state.chapterTitle = data.chapterTitle;
  state.updatedAt = new Date().toISOString();
  save(); apply();
  trackOnce('open'); setTimeout(function () { try { var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0]; var paints = performance.getEntriesByType && performance.getEntriesByType('paint') || []; var fcp = paints.find(function (p) { return p.name === 'first-contentful-paint'; }); track('paint', { ttfbMs: nav ? nav.responseStart : 0, fcpMs: fcp ? fcp.startTime : 0, cache: Boolean(nav && nav.transferSize === 0 && nav.duration > 0) }); } catch (ePaint) { /* 性能 API 缺席不影响阅读 */ } }, 0);

  // v5.25 阅读体验深化：插图点击放大（lightbox）——图、图注、出处一屏呈现。
  // 遮罩挂 body（翻页模式的 transform 容器内 fixed 会失效）；ESC/点击关闭。
  (function illustrationLightbox() {
    var figs = document.querySelectorAll('.reader-content .ill-figure img');
    if (!figs.length) return;
    var box = null;
    function close() { if (box) { box.remove(); box = null; document.removeEventListener('keydown', onKey); } }
    function onKey(e) { if (e.key === 'Escape') close(); }
    figs.forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        var fig = img.closest('.ill-figure');
        var cap = fig && fig.nextElementSibling && fig.nextElementSibling.tagName === 'P' ? fig.nextElementSibling.textContent : (img.alt || '');
        var credit = '';
        if (fig && fig.nextElementSibling && fig.nextElementSibling.nextElementSibling && fig.nextElementSibling.nextElementSibling.tagName === 'BLOCKQUOTE') {
          credit = fig.nextElementSibling.nextElementSibling.textContent;
        }
        box = h('div', 'ill-lightbox', '<figure><img src="' + esc(img.src) + '" alt=""><figcaption>' + esc(cap || '') + (credit ? '<small>' + esc(credit) + '</small>' : '') + '</figcaption></figure>');
        box.addEventListener('click', close);
        document.body.appendChild(box);
        document.addEventListener('keydown', onKey);
      });
    });
  })();

  document.querySelectorAll('[data-setting]').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.dataset.setting, value = b.dataset.value;
      state[name] = (name === 'width' || name === 'leading') ? Number(value) : value;
      save(); apply(); layout(true);
    });
  });
  document.querySelectorAll('[data-font-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.font = Math.max(14, Math.min(26, state.font + Number(b.dataset.fontStep)));
      save(); apply(); layout(true);
    });
  });
  var readerPanels = (function installReaderPanels({ document, window, settings, drawer, mask, onOpenDrawer, onCloseDrawer, english }) {
  const settingsButton = document.querySelector('[data-toggle-settings]');
  const drawerButton = document.querySelector('[data-toggle-drawer]');
  const panels = { settings, contents: drawer };
  const buttons = { settings: settingsButton, contents: drawerButton };
  let active = null;
  let returnFocus = null;
  let ownsHistory = false;
  let closingHistory = false;
  let queued = null;
  let afterClose = null;
  const mobile = () => window.matchMedia('(max-width:980px)').matches;
  const focusables = panel => [...panel.querySelectorAll('button,a[href],input,textarea,select,[tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);

  function update() {
    settings.hidden = active !== 'settings';
    if (panels.notes) panels.notes.hidden = active !== 'notes';
    document.body.classList.toggle('drawer-open', active === 'contents');
    if (drawer) drawer.inert = mobile() && active !== 'contents';
    for (const [name, panel] of Object.entries(panels)) {
      if (!panel) continue;
      if (buttons[name]) buttons[name].setAttribute('aria-expanded', String(active === name));
      const modal = active === name && (name !== 'contents' || mobile());
      if (modal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
    }
  }

  function hide(restoreFocus = true) {
    if (active === 'contents') onCloseDrawer();
    active = null;
    update();
    if (restoreFocus && returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }

  function close(callback) {
    afterClose = typeof callback === 'function' ? callback : null;
    queued = null;
    hide();
    if (ownsHistory && window.history.state?.haiReaderPanel) {
      ownsHistory = false;
      closingHistory = true;
      window.history.back();
    } else if (afterClose) {
      const done = afterClose; afterClose = null; done();
    }
  }

  function focusPanel(name) {
    const target = name === 'notes' && panels[name].querySelector('textarea');
    (target || focusables(panels[name])[0] || panels[name]).focus({ preventScroll: true });
  }

  function open(name, replace = false) {
    if (!panels[name]) return;
    if (closingHistory) { queued = name; return; }
    if (active === name && !replace) { close(); return; }
    if (active === 'contents') onCloseDrawer();
    if (!active) returnFocus = document.activeElement;
    active = name;
    update();
    try {
      const state = { ...window.history.state, haiReaderPanel: name };
      if (ownsHistory) window.history.replaceState(state, '');
      else { window.history.pushState(state, ''); ownsHistory = true; }
    } catch { /* Restricted history must not prevent opening a panel. */ }
    if (name === 'contents') onOpenDrawer();
    focusPanel(name);
  }

  function prepare(name, panel) {
    panel.id = 'reader-panel-' + name;
    panel.tabIndex = -1;
    const labels = english ? { settings: 'Reading settings', contents: 'Contents', notes: 'Thoughts' }
      : { settings: '阅读设置', contents: '目录', notes: '想法' };
    panel.setAttribute('aria-label', labels[name]);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'reader-panel-close'; button.textContent = '×';
    button.setAttribute('aria-label', english ? 'Close' : '关闭');
    button.addEventListener('click', close);
    panel.insertBefore(button, panel.firstChild);
  }
  for (const [name, panel] of Object.entries(panels)) {
    if (!panel) continue;
    prepare(name, panel);
    if (buttons[name]) {
      buttons[name].setAttribute('aria-controls', panel.id);
      buttons[name].addEventListener('click', event => { event.stopPropagation(); open(name); });
    }
  }
  settings.addEventListener('click', event => event.stopPropagation());
  mask.addEventListener('click', close);
  document.addEventListener('click', event => {
    if (active === 'settings' && !settings.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab' || (active === 'contents' && !mobile())) return;
    const panel = panels[active];
    const list = focusables(panel);
    const first = list[0] || panel, last = list.at(-1) || panel;
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  window.addEventListener('popstate', () => {
    const next = window.history.state?.haiReaderPanel;
    ownsHistory = Boolean(next && panels[next]);
    hide();
    if (ownsHistory) { active = next; update(); if (next === 'contents') onOpenDrawer(); focusPanel(next); }
    closingHistory = false;
    if (afterClose) {
      const done = afterClose; afterClose = null;
      window.requestAnimationFrame(done);
    }
    if (queued) { const name = queued; queued = null; open(name); }
  });
  window.addEventListener('resize', update);
  const restored = window.history.state?.haiReaderPanel;
  if (restored && panels[restored]) {
    active = restored;
    ownsHistory = true;
    if (active === 'contents') onOpenDrawer();
  }
  update();
  return {
    open, close,
    isOpen: name => name ? active === name : Boolean(active),
    showNotes(panel) {
      if (panels.notes) panels.notes.remove();
      panels.notes = panel;
      panel.hidden = true;
      prepare('notes', panel);
      open('notes', true);
    },
  };
})({
    document: document, window: window, settings: settings, drawer: drawer, mask: mask,
    english: data.lang === 'en',
    onOpenDrawer: function () { defer(restoreTocScroll); defer(loadBookmarkList); },
    onCloseDrawer: saveTocScroll
  });
  // v5.87 抽屉书签列表（用户定案：书签可保存可回访）：云端+本机合并渲染，
  // 点击跳到对应章的段落（同章直接翻页定位，跨章 sessionStorage 递话）
  function loadBookmarkList() {
    var host = document.querySelector('[data-bm-list]');
    if (!host || host.dataset.loaded) return;
    host.dataset.loaded = '1';
    var localRows = [];
    try { localRows = (JSON.parse(localStorage.getItem('historyai.bookmarks') || '[]') || []).filter(function (r) { return r && r.bookId === data.bookId; }); } catch (eB) {}
    fetch('/api/reader/bookmarks?bookId=' + encodeURIComponent(data.bookId || ''), { credentials: 'same-origin' })
      .then(function (r) { return r.status === 401 ? { rows: [] } : r.json(); })
      .catch(function () { return { rows: [] }; })
      .then(function (d) {
        var rows2 = (d && d.rows || []).concat(localRows.reverse());
        if (!rows2.length) return;
        host.innerHTML = '';
        rows2.slice(0, 30).forEach(function (r) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'bm-row';
          b.innerHTML = '<b>' + (data.lang === 'en' ? 'Ch.' : '第') + (Number(r.chapter) + 1) + (data.lang === 'en' ? '' : '章') + '</b>' + String(r.quote || '').slice(0, 42).replace(/[<>&]/g, '');
          b.addEventListener('click', function () {
            if (Number(r.chapter) === Number(data.chapter)) { readerPanels.close(function () { jumpToPara(Number(r.para) || 0); }); return; }
            try { sessionStorage.setItem('historyai.reader.bmjump', JSON.stringify({ bookId: data.bookId, chapter: Number(r.chapter), para: Number(r.para) || 0 })); } catch (eJ) {}
            location.href = chapterHref(Number(r.chapter));
          });
          host.appendChild(b);
        });
      });
  }
  function jumpToPara(idx) {
    var ps = document.querySelectorAll('.reader-content p');
    var el = ps[Math.max(0, Math.min(ps.length - 1, idx))];
    if (!el) return;
    if (state.mode === 'page' && typeof step === 'number' && step > 0) { go(Math.round(el.offsetLeft / step)); }
    else { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  (function installReaderLifecycle({ window, document, content, persist, scroll, layout, restore }) {
  let scrollTimer, layoutTimer;
  function saveNow() {
    window.clearTimeout(scrollTimer);
    persist();
  }
  function reflow() {
    window.clearTimeout(layoutTimer);
    layoutTimer = window.setTimeout(() => {
      if (document.visibilityState !== 'hidden') layout();
    }, 150);
  }
  window.addEventListener('scroll', () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(scroll, 100);
  }, { passive: true });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
    else reflow();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { restore(); layout(); }
  });
  window.addEventListener('resize', reflow);
  window.visualViewport?.addEventListener('resize', reflow);
  window.addEventListener('load', reflow);
  content?.addEventListener('load', event => { if (event.target.tagName === 'IMG') reflow(); }, true);
  document.fonts?.ready.then(reflow).catch(() => {});
})({
    window: window, document: document, content: document.querySelector('.reader-content'),
    persist: function () { if (state.mode === 'scroll') scrollProgress(); else save(); },
    scroll: scrollProgress, layout: function () { layout(true); },
    restore: function () { applyingSync = false; }
  });

  // v4.98.1 点按翻页（Kindle 式）：左 1/3 上一页，其余下一页。轻点统一走 click
  // 通道——触屏轻点有合成 click、滑动没有，天然分流；滑动归下方 touch 通道独管。
  if (paper) {
    paper.addEventListener('click', function (e) {
      if (state.mode !== 'page') return;
      if (!settings.hidden || document.body.classList.contains('drawer-open')) return;
      if (readerPanels.isOpen('notes')) { readerPanels.close(); return; } // 想法面板开着：点正文=收起，不翻页
      if (e.target.closest && e.target.closest('a,button,input,textarea,label,.idea-dot,.review-box')) return;
      try { if (window.getSelection && String(window.getSelection())) return; } catch (e9) {}
      // v5.87 三分区（微信读书式）：左 30% 上一页 / 中 40% 收放工具栏 / 右 30% 下一页
      var x = e.clientX / innerWidth;
      if (x < 0.3) flip(-1, true);
      else if (x > 0.7) flip(1, true);
      else document.body.classList.toggle('chrome-hidden');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (readerPanels.isOpen() || document.querySelector('.ill-lightbox')) return;
    if (e.target.closest && e.target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="dialog"]')) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); flip(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flip(-1); }
  });
  // v4.86 触摸翻页→v4.98.1 收束：本通道只管横滑（>56px），轻点已归 click 通道。
  // 实弹教训：曾与 paper 触摸手势共用 var tx（函数级作用域相撞），先到的 touchend
  // 把坐标置 null，后到的算出假位移——右侧轻点被一退一进抵消成「点了没反应」。
  var swipeX = null, swipeY = 0, swipeT = 0;
  addEventListener('touchstart', function (e) {
    swipeX = null;
    if (readerPanels.isOpen()) return;
    if (!paper || !paper.contains(e.target)) return;
    if (!e.touches || e.touches.length !== 1) { swipeX = null; return; }
    swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; swipeT = Date.now();
  }, { passive: true });
  addEventListener('touchend', function (e) {
    if (readerPanels.isOpen()) { swipeX = null; return; }
    if (state.mode !== 'page' || swipeX === null) return;
    var c = e.changedTouches && e.changedTouches[0]; if (!c) return;
    var dx = c.clientX - swipeX, dy = c.clientY - swipeY, dt = Date.now() - swipeT;
    swipeX = null;
    if (dt >= 600 || Math.abs(dx) <= 56 || Math.abs(dy) >= 48) return;
    try { if (window.getSelection && String(window.getSelection())) return; } catch (e4) {}
    if (e.target.closest && e.target.closest('a,button,input,textarea,label,.settings,.chapter-drawer,.idea-sheet,.review-box')) return;
    flip(dx < 0 ? 1 : -1, true);
  }, { passive: true });
  addEventListener('touchcancel', function () { swipeX = null; }, { passive: true });
  // v5.87 跨章书签落点：上一页面把目标段写进 sessionStorage，本章加载后翻过去
  (function bmJumpLanding() {
    try {
      var raw = sessionStorage.getItem('historyai.reader.bmjump');
      if (!raw) return;
      var j = JSON.parse(raw);
      if (!j || j.bookId !== data.bookId || Number(j.chapter) !== Number(data.chapter)) return;
      sessionStorage.removeItem('historyai.reader.bmjump');
      setTimeout(function () { jumpToPara(Number(j.para) || 0); }, 220);
    } catch (eJ2) {}
  })();
  // v4.87 章末大按钮：正文末尾醒目「下一章」，末章给「全书完·返回书库」
  (function bigNext() {
    var content = document.querySelector('.reader-content');
    if (!content) return;
    var a = document.createElement('a');
    a.className = 'big-next';
    if (nextHref) { a.href = nextHref; a.textContent = (titles[Number(data.chapter) + 1] ? '下一章 · ' + titles[Number(data.chapter) + 1] : '下一章') + ' →'; }
    else { a.href = (L.home || '../../../../index.html'); a.textContent = data.lang === 'en' ? '🎉 The end · Back to library' : '🎉 全书完 · 返回书库'; }
    content.appendChild(a);
  })();
  // ── v4.97 书的社交层（对标微信读书）：想法气泡/底部面板/末章打分书评 ──
  (function socialLayer() {
    var EN2 = data.lang === 'en';
    function T(zh, en) { return EN2 ? en : zh; }
    var myUid = null, loggedIn2 = false;
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok && d.user) {
        loggedIn2 = true; myUid = d.user.id;
        refreshNotes(); // v6.9.26 登录态确定后重绘划线（「我的划线」实线样式依赖 myUid）
        // v5.8 通知小红点（P2）：有未读时点亮顶栏「书架」，进书架页即清
        fetch('/api/reader/notifications?countOnly=1', { credentials: 'same-origin' })
          .then(function (r5) { return r5.ok ? r5.json() : null; })
          .then(function (n5) {
            if (n5 && n5.ok && n5.unread > 0) {
              var sl = document.querySelector('a.icon-button[href="/shelf.html"]');
              if (sl) {
                var dot = document.createElement('i');
                dot.style.cssText = 'display:inline-block;width:7px;height:7px;margin-left:4px;border-radius:50%;background:#e2574f;vertical-align:super';
                sl.appendChild(dot);
              }
            }
          }).catch(function () {});
      }
    }).catch(function () {});
    function post2(path2, body2) {
      return fetch(path2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body2) }).then(function (r) { return r.json(); });
    }
    function el2(tag, cls, text2) { var e = document.createElement(tag); if (cls) e.className = cls; if (text2 != null) e.textContent = text2; return e; }
    function loginHint(box) {
      var h = el2('p', 'idea-hint');
      h.innerHTML = '';
      var a = el2('a', '', T('登录后参与讨论', 'Sign in to join the discussion'));
      a.href = 'https://write.evoronai.com/login.html';
      h.appendChild(a);
      box.appendChild(h);
    }
    var sheet = null;
    var noteDrafts = Object.create(null);
    function closeSheet() { if (readerPanels.isOpen('notes')) readerPanels.close(); }
    function showSheet() { document.body.appendChild(sheet); readerPanels.showNotes(sheet); }
    function renderItem(box, item, kind, refresh) {
      var it = el2('div', 'idea-item');
      var who = el2('div', 'who');
      var b = el2('b', '', item.name || T('读者', 'Reader'));
      who.appendChild(b);
      who.appendChild(document.createTextNode(' · ' + String(item.at || '').slice(0, 10) + (item.rating ? ' · ' + '★'.repeat(item.rating) : '')));
      it.appendChild(who);
      if (item.text) it.appendChild(el2('p', 'txt', item.text));
      (item._replies || []).forEach(function (rp) {
        var rr = el2('div', 'idea-reply');
        var rw = el2('span', 'who');
        rw.appendChild(el2('b', '', rp.name || T('读者', 'Reader')));
        rr.appendChild(rw);
        rr.appendChild(el2('p', 'txt', rp.text));
        if (myUid && (rp.uid === myUid)) {
          var dr = el2('div', 'idea-act');
          var ds = el2('span', '', T('删除', 'Delete'));
          ds.onclick = function () { post2('/api/book/delete', { bookId: data.bookId, kind: 'reply', id: rp.id }).then(refresh); };
          dr.appendChild(ds);
          rr.appendChild(dr);
        }
        it.appendChild(rr);
      });
      var act = el2('div', 'idea-act');
      // v5.8 点赞（P2）：♥ 幂等 toggle，点亮通知作者
      var lk = el2('span', '', (item.likedByMe ? '♥ ' : '♡ ') + (Number(item.likeCount) || T('赞', 'Like')));
      if (item.likedByMe) lk.style.color = 'var(--reader-accent)';
      lk.onclick = function () {
        if (!loggedIn2) { alert(T('登录后才能点赞', 'Sign in to like')); return; }
        post2('/api/book/like', { bookId: data.bookId, kind: kind, id: item.id, bookTitle: data.title || '' }).then(function (r4) {
          if (r4 && r4.ok) {
            lk.textContent = (r4.liked ? '♥ ' : '♡ ') + (r4.count || T('赞', 'Like'));
            lk.style.color = r4.liked ? 'var(--reader-accent)' : '';
          }
        });
      };
      act.appendChild(lk);
      var rb = el2('span', '', T('回复', 'Reply'));
      rb.onclick = function () {
        if (!loggedIn2) { alert(T('登录后才能回复', 'Sign in to reply')); return; }
        var old = it.querySelector('.idea-input');
        if (old) { old.remove(); return; }
        var row = el2('div', 'idea-input');
        var ta = document.createElement('textarea');
        ta.placeholder = T('写下你的回复…', 'Write a reply…');
        var go = el2('button', '', T('发表', 'Post'));
        go.onclick = function () {
          var v = ta.value.trim();
          if (!v) return;
          post2('/api/book/replies', { bookId: data.bookId, kind: kind, targetId: item.id, text: v }).then(function (r2) {
            if (r2 && r2.ok) refresh(); else alert((r2 && r2.error) || T('发表失败', 'Failed'));
          });
        };
        row.appendChild(ta); row.appendChild(go);
        it.appendChild(row);
      };
      act.appendChild(rb);
      if (myUid && item.uid === myUid) {
        var del = el2('span', '', T('删除', 'Delete'));
        del.onclick = function () { post2('/api/book/delete', { bookId: data.bookId, kind: kind, id: item.id }).then(refresh); };
        act.appendChild(del);
      }
      it.appendChild(act);
      box.appendChild(it);
    }
    function attachReplies(items, replies) {
      items.forEach(function (n) { n._replies = (replies || []).filter(function (r) { return r.targetId === n.id; }); });
    }
    // 想法气泡：按引文定位段落
    // v6.9.26 划线进正文（微信读书式）：同引文聚合成一条下划线（他人虚线、
    // 含自己实线、≥2 人缀人数角标），点下划线开面板；纯划线（text 空）只出
    // 下划线不出气泡，气泡只数有想法的条目。角标用 ::after+data-n，零文本
    // 变异——插入可见字符会破坏后续引文的偏移定位。
    var notesCache = [];
    function unwrapHl() {
      document.querySelectorAll('.reader-content .hai-hl').forEach(function (s) {
        var pn = s.parentNode;
        while (s.firstChild) pn.insertBefore(s.firstChild, s);
        pn.removeChild(s);
        pn.normalize();
      });
    }
    function wrapQuote(p, quote, cls, group) {
      var full = p.textContent || '';
      var idx = full.indexOf(quote);
      var len = quote.length;
      if (idx < 0) {
        idx = full.indexOf(quote.slice(0, 40));
        if (idx < 0) return;
        len = Math.min(len, full.length - idx);
      }
      var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
      var pos = 0, node, targets = [];
      while ((node = walker.nextNode())) {
        var nl = node.nodeValue.length;
        var a = Math.max(idx, pos), b = Math.min(idx + len, pos + nl);
        if (b > a) targets.push({ node: node, from: a - pos, to: b - pos });
        pos += nl;
        if (pos >= idx + len) break;
      }
      var last = null;
      for (var ti = 0; ti < targets.length; ti++) {
        var r = document.createRange();
        r.setStart(targets[ti].node, targets[ti].from);
        r.setEnd(targets[ti].node, targets[ti].to);
        var span = document.createElement('span');
        span.className = cls;
        try { r.surroundContents(span); } catch (e9) { continue; }
        span.onclick = function (ev3) { ev3.stopPropagation(); openSheet(group, p); };
        last = span;
      }
      if (last && group.length > 1) last.setAttribute('data-n', String(group.length));
    }
    function refreshNotes() {
      fetch('/api/book/notes?bookId=' + encodeURIComponent(data.bookId) + '&chapter=' + (Number(data.chapter) + 1))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!(d && d.ok)) return;
          attachReplies(d.notes, d.replies);
          notesCache = d.notes;
          document.querySelectorAll('.idea-dot').forEach(function (x) { x.remove(); });
          unwrapHl();
          var ps = document.querySelectorAll('.reader-content p');
          var byPara = {};
          var byQuote = {};
          d.notes.forEach(function (n) {
            var hit = -1;
            for (var i = 0; i < ps.length; i++) {
              if ((ps[i].textContent || '').indexOf(n.quote.slice(0, 60)) !== -1) { hit = i; break; }
            }
            n._para = hit;
            if (n.text) (byPara[hit] = byPara[hit] || []).push(n);
            if (hit >= 0) (byQuote[n.quote] = byQuote[n.quote] || []).push(n);
          });
          Object.keys(byQuote).forEach(function (q) {
            var group = byQuote[q];
            var p2 = ps[group[0]._para];
            if (!p2) return;
            var mine = group.some(function (n) { return myUid && n.uid === myUid; });
            wrapQuote(p2, q, 'hai-hl' + (mine ? ' mine' : ''), group);
          });
          Object.keys(byPara).forEach(function (k) {
            var i2 = Number(k);
            if (i2 < 0 || !ps[i2]) return;
            var dot = el2('sup', 'idea-dot', '');
            dot.innerHTML = '<img class="idea-dot-ico" src="../../assets/icons/speech.png" alt="">' + byPara[k].length;
            dot.onclick = function (ev2) { ev2.stopPropagation(); openSheet(byPara[k], ps[i2]); };
            ps[i2].appendChild(dot);
          });
          if (typeof layout === 'function') layout(true);
        }).catch(function () {});
    }
    function openSheet(notes2, paraEl) {
      sheet = el2('div', 'idea-sheet');
      var thoughts = notes2.filter(function (n) { return n.text; });
      var marks = notes2.filter(function (n) { return !n.text; });
      sheet.appendChild(el2('h4', '', thoughts.length ? T('想法', 'Thoughts') + ' · ' + thoughts.length : T('划线', 'Underlines')));
      sheet.appendChild(el2('p', 'idea-quote', notes2[0].quote));
      if (marks.length) {
        var mrow = el2('p', 'idea-hint', T(marks.length + ' 人划过这里', marks.length + (marks.length > 1 ? ' readers underlined this' : ' reader underlined this')));
        var minem = null;
        for (var mi = 0; mi < marks.length; mi++) if (myUid && marks[mi].uid === myUid) { minem = marks[mi]; break; }
        if (minem) {
          var un = el2('a', '', T(' · 取消我的划线', ' · Remove mine'));
          un.style.cursor = 'pointer';
          un.onclick = function () { post2('/api/book/delete', { bookId: data.bookId, kind: 'note', id: minem.id }).then(refreshAll); };
          mrow.appendChild(un);
        }
        sheet.appendChild(mrow);
      }
      thoughts.forEach(function (n) { renderItem(sheet, n, 'note', refreshAll); });
      if (!loggedIn2) loginHint(sheet);
      var x = el2('div', 'idea-act');
      var w = el2('button', '', T('写想法', 'Add a thought'));
      w.onclick = function () {
        var q = notes2[0].quote;
        var pi = Math.max(0, Number(notes2[0]._para) || 0);
        if (window.__haiIdeaCompose) window.__haiIdeaCompose(q, pi);
      };
      x.appendChild(w);
      var c = el2('button', '', T('关闭', 'Close'));
      c.onclick = closeSheet;
      x.appendChild(c);
      sheet.appendChild(x);
      showSheet();
    }
    function refreshAll() { closeSheet(); refreshNotes(); }
    window.__haiNotesRefresh = refreshAll;
    // 想法作曲器（选择浮钮的 💬 调用）
    window.__haiIdeaCompose = function (quote, para) {
      sheet = el2('div', 'idea-sheet');
      sheet.appendChild(el2('h4', '', T('写想法', 'Add a thought')));
      sheet.appendChild(el2('p', 'idea-quote', quote));
      if (!loggedIn2) { loginHint(sheet); showSheet(); return; }
      var row = el2('div', 'idea-input');
      var ta = document.createElement('textarea');
      ta.placeholder = T('这段文字让你想到什么…', 'What does this passage make you think…');
      ta.setAttribute('aria-label', T('想法内容', 'Your thought'));
      var draftKey = JSON.stringify([para, quote]);
      ta.value = noteDrafts[draftKey] || '';
      ta.addEventListener('input', function () { noteDrafts[draftKey] = ta.value; });
      var submittedSheet = sheet;
      var go = el2('button', '', T('发表', 'Post'));
      go.onclick = function () {
        var v = ta.value.trim();
        if (!v) return;
        post2('/api/book/notes', { bookId: data.bookId, chapter: Number(data.chapter) + 1, para: para, quote: quote, text: v })
          .then(function (r2) {
            if (r2 && r2.ok) {
              var unchanged = ta.value.trim() === v;
              if (noteDrafts[draftKey] === ta.value && unchanged) delete noteDrafts[draftKey];
              if (unchanged) ta.value = '';
              if (sheet === submittedSheet && unchanged) closeSheet();
              refreshNotes();
            } else alert((r2 && r2.error) || T('发表失败', 'Failed'));
          }).catch(function () { alert(T('发表失败，输入已保留', 'Failed to post. Your text is preserved.')); });
      };
      row.appendChild(ta); row.appendChild(go);
      sheet.appendChild(row);
      var x2 = el2('div', 'idea-act');
      var c2 = el2('button', '', T('关闭', 'Close'));
      c2.onclick = closeSheet;
      x2.appendChild(c2);
      sheet.appendChild(x2);
      showSheet();
    };
    refreshNotes();
    // 末章：打分 + 书评
    if (!nextHref) {
      var content2 = document.querySelector('.reader-content');
      if (content2) {
        var box = el2('div', 'review-box');
        var mkRow = el2('div', '');
        var mkBtn = document.createElement('button');
        mkBtn.type = 'button';
        mkBtn.setAttribute('data-mark-finished', '1');
        mkBtn.style.cssText = 'min-height:36px;padding:0 18px;border:1px solid var(--reader-line);border-radius:18px;background:var(--reader-panel);color:var(--reader-accent);font-weight:700;cursor:pointer;margin-bottom:12px';
        mkBtn.textContent = T('✓ 标记读完', '✓ Mark as finished');
        mkBtn.onclick = function () {
          if (!loggedIn2) { alert(T('登录后即可标记读完', 'Sign in to mark as finished')); return; }
          post2('/api/reader/shelf', { bookId: data.bookId, title: data.title || '', status: 'finished' }).then(function (r2) {
            if (r2 && r2.ok) { mkBtn.textContent = T('✓ 已读完', '✓ Finished'); mkBtn.disabled = true; }
          });
        };
        mkRow.appendChild(mkBtn);
        box.appendChild(mkRow);
        fetch('/api/reader/shelf', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.ok && (d.rows || []).some(function (x) { return x.bookId === data.bookId && x.status === 'finished'; })) {
            mkBtn.textContent = T('✓ 已读完', '✓ Finished'); mkBtn.disabled = true;
          }
        }).catch(function () {});
        box.appendChild(el2('h3', '', T('读完了？给这本书打个分', 'Finished? Rate this book')));
        var agg = el2('p', 'review-agg', '');
        box.appendChild(agg);
        var stars = el2('div', 'stars');
        var myRating = 0;
        for (var si2 = 1; si2 <= 5; si2++) {
          (function (v2) {
            var sp = el2('span', '', '★');
            sp.onclick = function () {
              myRating = v2;
              stars.querySelectorAll('span').forEach(function (x3, i3) { x3.className = i3 < v2 ? 'on' : ''; });
            };
            stars.appendChild(sp);
          })(si2);
        }
        box.appendChild(stars);
        var row2 = el2('div', 'idea-input');
        var ta2 = document.createElement('textarea');
        ta2.placeholder = T('写几句书评（可选）…', 'Write a short review (optional)…');
        var go2 = el2('button', '', T('提交', 'Submit'));
        go2.onclick = function () {
          if (!loggedIn2) { alert(T('登录后才能评分', 'Sign in to rate')); return; }
          if (!myRating) { alert(T('先点星星打个分', 'Pick a star rating first')); return; }
          post2('/api/book/reviews', { bookId: data.bookId, rating: myRating, text: ta2.value.trim() })
            .then(function (r2) {
              if (r2 && r2.ok) {
                loadReviews();
                // v5.7 打完分=读完：书架状态顺手置位，不打扰
                post2('/api/reader/shelf', { bookId: data.bookId, status: 'finished', title: data.title || '' }).catch(function () {});
                if (finBtn) { finBtn.textContent = T('✓ 已读完', '✓ Finished'); finBtn.disabled = true; }
              } else alert((r2 && r2.error) || T('提交失败', 'Failed'));
            });
        };
        row2.appendChild(ta2); row2.appendChild(go2);
        box.appendChild(row2);
        // v5.7 书架三态（P1）：末章明示「标记读完」，不评分也能收进书架
        var finBtn = el2('button', 'icon-button text', T('✓ 标记读完（收进我的书架）', '✓ Mark as finished'));
        finBtn.style.cssText = 'margin-top:10px;border:1px solid var(--reader-line);border-radius:8px';
        finBtn.onclick = function () {
          if (!loggedIn2) { alert(T('登录后才能使用书架', 'Sign in to use your shelf')); return; }
          post2('/api/reader/shelf', { bookId: data.bookId, status: 'finished', title: data.title || '' })
            .then(function (r3) {
              if (r3 && r3.ok) { finBtn.textContent = T('✓ 已读完', '✓ Finished'); finBtn.disabled = true; }
              else alert((r3 && r3.error) || T('操作失败', 'Failed'));
            });
        };
        box.appendChild(finBtn);
        var listBox = el2('div', '');
        box.appendChild(listBox);
        // v5.8 书评双排序（P2）：最新（默认）/ 最热（点赞数优先）
        var reviewSort = 'new';
        function loadReviews() {
          fetch('/api/book/reviews?bookId=' + encodeURIComponent(data.bookId), { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!(d && d.ok)) return;
              agg.innerHTML = '';
              if (d.count) {
                var bb = el2('b', '', String(d.avg));
                agg.appendChild(bb);
                agg.appendChild(document.createTextNode(' · ' + d.count + T(' 人评分', ' ratings')));
                var st = el2('span', '', reviewSort === 'hot' ? T(' · 按最热 ↺', ' · by top ↺') : T(' · 按最新 ↺', ' · by newest ↺'));
                st.style.cursor = 'pointer';
                st.onclick = function () { reviewSort = reviewSort === 'hot' ? 'new' : 'hot'; loadReviews(); };
                agg.appendChild(st);
              } else {
                agg.textContent = T('还没有人评分，做第一个', 'No ratings yet — be the first');
              }
              listBox.innerHTML = '';
              attachReplies(d.reviews, d.replies);
              var rows3 = d.reviews.slice();
              if (reviewSort === 'hot') rows3.sort(function (a3, b3) { return (Number(b3.likeCount) || 0) - (Number(a3.likeCount) || 0); });
              rows3.forEach(function (rv) { renderItem(listBox, rv, 'review', loadReviews); });
              if (typeof layout === 'function') layout(true);
            }).catch(function () {});
        }
        loadReviews();
        content2.appendChild(box);
      }
    }
  })();

  // v6.9.26 阅读时长（微信读书向）：页面可见每 30s 记账入本机，目录头显示本书累计
  (function readTime() {
    if (!data.bookId) return;
    var tk = 'historyai.readtime.' + data.bookId;
    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      try { localStorage.setItem(tk, String((Number(localStorage.getItem(tk)) || 0) + 30)); } catch (e) { /* 隐私模式 */ }
    }, 30000);
    try {
      var secs = Number(localStorage.getItem(tk)) || 0;
      if (secs >= 60 && drawer) {
        var headSpan = drawer.querySelector('.drawer-head span');
        if (headSpan) headSpan.textContent += (data.lang === 'en' ? ' · read ' + Math.round(secs / 60) + ' min' : ' · 已读 ' + Math.round(secs / 60) + ' 分钟');
      }
    } catch (e2) { /* 隐私模式 */ }
  })();

  layout(false);
  positionReady = true;
  if (state.mode === 'page') {
    if (location.hash === '#last') go(total - 1);
    else {
      var restoredPage = savedAnchor && readerLocation.pageFor(savedAnchor, step);
      go(restoredPage != null ? restoredPage : savedPage, Boolean(savedAnchor && restoredPage != null));
    }
  } else {
    if (savedAnchor) restoreScrollAnchor(savedAnchor);
    scrollProgress();
  }
  (function installReaderEditionNotice({ document, window, data, policy, edition, location, releaseId, onAccept, onResize }) {
  const en = data.lang === 'en';
  const paper = document.querySelector('.reader-paper');
  let notice;
  function show(text) {
    if (notice) notice.remove();
    notice = document.createElement('section');
    notice.className = 'reader-edition';
    notice.setAttribute('aria-label', en ? 'Book edition' : '书籍版本');
    const message = document.createElement('p'); message.textContent = text;
    notice.appendChild(message);
    const actions = document.createElement('div'); notice.appendChild(actions);
    paper.prepend(notice);
    return actions;
  }
  function button(actions, text, action, name) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
    el.dataset.editionAction = name;
    el.addEventListener('click', event => { event.stopPropagation(); action(); });
    actions.appendChild(el);
  }
  function link(actions, text, href) {
    const el = document.createElement('a'); el.textContent = text; el.href = href;
    el.addEventListener('click', event => event.stopPropagation()); actions.appendChild(el);
  }
  const segments = window.location.pathname.split('/');
  const bookIndex = segments.indexOf('books');
  const standardPath = bookIndex >= 0 && segments[bookIndex + 1] === data.bookId && segments[bookIndex + 2] === 'releases';
  if (!edition.canSave()) {
    const actions = show(edition.needsRecovery
      ? (en ? 'Your saved position could not be read. It will not be overwritten.' : '暂时无法读取原进度，不会自动覆盖。')
      : (en ? 'This edition has changed. Your previous position is kept separately.' : '书籍版本已变化，原阅读进度将单独保留。'));
    const previous = edition.previous;
    const index = policy.chapterFor(previous, releaseId, data.chapterTitles || []);
    const anchor = index === Number(data.chapter) ? location.migrate(previous.anchor) : null;
    function accept(value) {
      if (!edition.accept()) {
        notice.querySelector('p').textContent = en ? 'Could not save the previous position. Free some browser storage and try again; reading remains available.' : '暂时无法备份原进度。请释放浏览器存储后重试；仍可阅读，原进度不会覆盖。';
        onResize(); return;
      }
      notice.remove(); notice = null; onAccept(value);
    }
    if (anchor) button(actions, en ? 'Resume at matching text' : '接续原文位置', () => accept(anchor), 'resume');
    const oldRelease = policy.releaseOf(previous);
    if (standardPath && oldRelease && Number.isInteger(previous.chapter) && previous.chapter >= 0) {
      link(actions, en ? 'Read previous edition' : '继续旧版', '../../releases/' + oldRelease + '/ch-' + (previous.chapter + 1) + '.html');
    }
    button(actions, en ? 'Start this chapter' : '从本章开始', () => accept(null), 'start');
    onResize();
    return;
  }
  if (!standardPath) return;
  window.fetch('../../release.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(release => {
    if (!release || !policy.validId(release.releaseId) || release.releaseId === releaseId) return;
    const titles = (Array.isArray(release.chapters) ? release.chapters : []).map(ch => String(ch?.title || ''));
    const index = policy.chapterFor({ releaseId, chapter: data.chapter, chapterTitle: data.chapterTitle }, release.releaseId, titles);
    const actions = show(en ? 'A newer edition is available.' : '本书有新版本。');
    link(actions, index >= 0 ? (en ? 'View new edition' : '查看新版') : (en ? 'Open new edition' : '打开新版'),
      '../../releases/' + release.releaseId + '/' + (index >= 0 ? 'ch-' + (index + 1) + '.html' : 'read.html'));
    button(actions, en ? 'Stay here' : '留在当前版本', () => { notice.remove(); notice = null; onResize(); }, 'stay');
    onResize();
  }).catch(() => { /* Offline readers keep the current edition. */ });
})({
    document: document, window: window, data: data, policy: editionPolicy, edition: readerEdition,
    location: readerLocation, releaseId: releaseId,
    onResize: function () { layout(true); },
    onAccept: function (anchor) {
      state.anchor = anchor;
      if (anchor) layout(true);
      else if (state.mode === 'page') { page = 0; layout(false); }
      else { window.scrollTo({ top: 0, behavior: 'instant' }); scrollProgress(); }
      if (readerSync) readerSync.connect();
    }
  });
  readerSync = (function installReaderSync({ window, document, data, initialPosition, canSync, getPosition, onRemote, onResize, createSync }) {
  const en = data.lang === 'en';
  let banner = null, status = null, controller;
  const indicator = document.createElement('span'); indicator.className = 'reader-sync-status';
  indicator.setAttribute('aria-live', 'polite');
  document.querySelector('.reader-tools')?.prepend(indicator);
  function request(url, options = {}) {
    const abort = new window.AbortController();
    const timeout = window.setTimeout(() => abort.abort(), 10000);
    return window.fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, signal: abort.signal })
      .then(async response => ({ status: response.status, body: await response.json() }))
      .finally(() => window.clearTimeout(timeout));
  }
  const storage = {
    get length() { return window.localStorage.length; }, key: index => window.localStorage.key(index),
    getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
  };
  controller = createSync({
    storage, bookId: data.bookId, initialPosition,
    initialOwner: initialPosition?.readerUserId || '', canSync, getPosition,
    onRemote, randomId: () => window.crypto.randomUUID(),
    schedule: (fn, delay) => window.setTimeout(fn, delay), cancel: timer => window.clearTimeout(timer),
    transport: {
      account: async () => {
        const r = await request('/api/auth/me');
        if (r.status >= 500) throw Error('account unavailable');
        return r.body?.ok ? r.body.user : null;
      },
      get: bookId => request('/api/reader/progress?bookId=' + encodeURIComponent(bookId)
        + '&syncUserId=' + encodeURIComponent(controller.userId())),
      post: (body, keepalive) => request('/api/reader/progress', { method: 'POST', keepalive,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    },
    onChange(value) {
      const labels = en ? { saved: 'Synced', syncing: 'Syncing', pending: 'Pending sync', offline: 'Sync offline', ready: '', anonymous: '',
        account: 'Sign in again', upgrade: 'Refresh to sync', error: 'Sync paused', storage: 'Storage unavailable', conflict: 'Choose position' }
        : { saved: '已同步', syncing: '同步中', pending: '待同步', offline: '同步离线', ready: '', anonymous: '', account: '请重新登录',
          upgrade: '刷新后同步', error: '同步已暂停', storage: '存储不可用', conflict: '选择阅读位置' };
      indicator.textContent = labels[value.status] || '';
      const signature = JSON.stringify([value.status, value.local, value.remote]);
      if (status === signature) return;
      status = signature;
      const hadBanner = Boolean(banner);
      if (banner) { banner.remove(); banner = null; }
      if (value.status !== 'conflict') { if (hadBanner) onResize(); return; }
      banner = document.createElement('section'); banner.className = 'reader-edition reader-sync-choice';
      const text = document.createElement('p'); text.textContent = en ? 'Your local and cloud positions differ.' : '本机与云端阅读位置不同，请选择。';
      banner.appendChild(text);
      const actions = document.createElement('div'); banner.appendChild(actions);
      function choice(label, row, action, name) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.syncChoice = name;
        button.textContent = label + (row ? ' · ' + (Number(row.chapter) + 1) + ' · ' + (row.chapterTitle || '') : '');
        if (row?.anchor) button.textContent += en ? ' · paragraph ' + (row.anchor.block + 1) : ' · 第 ' + (row.anchor.block + 1) + ' 段';
        if (row && value.remote && value.local.releaseId !== value.remote.releaseId) button.textContent += ' · ' + row.releaseId;
        button.addEventListener('click', e => { e.stopPropagation(); action(); }); actions.appendChild(button);
      }
      choice(en ? 'Use local position' : '使用本机位置', value.local, () => controller.chooseLocal(), 'local');
      if (value.remote) choice(en ? 'Use cloud position' : '使用云端位置', value.remote, () => controller.chooseRemote(), 'remote');
      document.querySelector('.reader-paper').prepend(banner); onResize();
    },
  });
  window.addEventListener('online', () => controller.connect());
  window.addEventListener('focus', () => controller.connect());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') controller.flush(true);
    else controller.connect();
  });
  window.addEventListener('pagehide', () => controller.flush(true));
  window.addEventListener('pageshow', event => { if (event.persisted) controller.connect(); });
  controller.connect();
  return controller;
})({
    window: window, document: document, data: data, initialPosition: initialPosition,
    canSync: function () { return readerEdition.canSave(); }, getPosition: syncPosition,
    createSync: (function createReaderSync({ transport, storage, bookId, getPosition, canSync, onRemote, onChange,
  initialOwner = '', initialPosition = null, randomId, schedule, cancel }) {
  let uid = '', revision = null, ready = false, busy = false, conflict = null;
  let pending = null, desired = null, timer, epoch = 0, retry = 2000, stopped = false, applying = false;
  let connectedPosition = initialPosition, connectedOwner = initialOwner;
  const prefix = () => 'historyai.reader-sync.' + uid + '.' + bookId + '.';
  const same = (a, b) => {
    if (!a || !b || a.releaseId !== b.releaseId || a.chapter !== b.chapter) return false;
    if (a.anchor || b.anchor) return Boolean(a.anchor && b.anchor && a.anchor.hash === b.anchor.hash
      && a.anchor.block === b.anchor.block && a.anchor.length === b.anchor.length
      && a.anchor.offset === b.anchor.offset && a.chapterTitle === b.chapterTitle);
    return a.page === b.page;
  };
  let observed = getPosition();
  const emit = (status, extra = {}) => onChange({ status, uid, ...extra });
  function records() {
    const rows = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith(prefix())) continue;
      try {
        const body = JSON.parse(storage.getItem(key));
        if (body.syncUserId === uid && body.bookId === bookId && body.syncVersion === 2
          && key === prefix() + body.mutationId) rows.push({ key, body });
      } catch { /* Preserve damaged records; never send them to another account. */ }
    }
    return rows;
  }
  function write(position, baseRevision) {
    const body = { ...position, bookId, syncUserId: uid, syncVersion: 2, baseRevision, mutationId: randomId() };
    const key = prefix() + body.mutationId;
    try {
      const raw = JSON.stringify(body);
      storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw Error('storage');
      return { key, body };
    } catch { emit('storage'); return null; }
  }
  function remove(record) {
    if (record) { try { storage.removeItem(record.key); } catch { /* Retrying the immutable operation is safe. */ } }
  }
  function later(delay = 5000) {
    cancel(timer); timer = schedule(() => flush(), delay);
  }
  function showConflict(remote, rev, local) {
    ready = true; revision = rev;
    conflict = { remote, local: local || desired?.body || pending?.body || getPosition() };
    emit('conflict', { ...conflict, count: records().length });
  }
  function note(position) {
    if (applying) return;
    if (same(position, observed)) return;
    observed = position;
    if (!uid || !ready || !canSync() || stopped) return;
    const next = write(position, revision);
    if (!next) return;
    remove(desired); desired = next;
    if (conflict) { conflict.local = position; emit('conflict', { ...conflict, count: records().length }); return; }
    emit('pending'); later();
  }
  async function flush(keepalive = false) {
    if (!ready || !uid || busy || conflict || !canSync() || stopped) return;
    if (!pending) { pending = desired; desired = null; }
    if (!pending) return;
    busy = true;
    const token = epoch, sent = pending;
    emit('syncing');
    try {
      const result = await transport.post(sent.body, keepalive);
      if (token !== epoch) return;
      const body = result.body || {};
      if (result.status === 401) { ready = false; emit('account'); return; }
      if (result.status === 428) { stopped = true; emit('upgrade'); return; }
      if (result.status === 409) {
        if (!Number.isSafeInteger(body.revision)) { stopped = true; emit('error'); return; }
        showConflict(body.row, body.revision); return;
      }
      if (result.status >= 500) throw Error('retry');
      if (!body.ok || body.mutationId !== sent.body.mutationId || !Number.isSafeInteger(body.revision)) {
        stopped = true; emit('error'); return;
      }
      if (body.replayed && body.appliedRevision !== body.revision) {
        showConflict(body.row, body.revision); return;
      }
      remove(sent); pending = null; revision = body.revision; retry = 2000;
      connectedPosition = sent.body; connectedOwner = uid;
      if (desired) {
        // Only rebase this page's next intent after its own confirmed write.
        const next = write(desired.body, revision);
        if (!next) { stopped = true; return; }
        remove(desired); desired = next;
        later();
      } else {
        const remaining = records();
        if (remaining.length) showConflict(body.row, revision, remaining[0].body);
        else if (!same(getPosition(), sent.body)) showConflict(body.row, revision, getPosition());
        else emit('saved');
      }
    } catch {
      if (token !== epoch) return;
      emit('offline'); later(retry); retry = Math.min(30000, retry * 2);
    } finally { if (token === epoch) busy = false; }
  }
  async function connect() {
    const token = ++epoch;
    cancel(timer); busy = false; ready = false; stopped = false;
    try {
      const account = await transport.account();
      if (token !== epoch) return;
      const nextUid = account?.id || '';
      if (nextUid !== uid) { uid = nextUid; pending = null; desired = null; conflict = null; }
      if (!uid) { emit('anonymous'); return; }
      const response = await transport.get(bookId);
      if (token !== epoch) return;
      const data = response.body || {};
      if (response.status === 401) { emit('account'); return; }
      if (response.status >= 500) throw Error('retry');
      if (!data.ok || data.syncVersion !== 2 || !Number.isSafeInteger(data.revision)) { emit('upgrade'); return; }
      revision = data.revision; ready = true;
      const queued = records();
      if (queued.length) {
        // Recovered operations retain their original baseline and identity.
        pending = queued[0]; desired = null; conflict = null;
        await flush(); return;
      }
      const current = getPosition();
      // A wishlist entry without a chapter is not a saved reading position.
      const remote = Number.isInteger(data.row?.chapter) ? data.row : null;
      const navigation = connectedOwner === uid && same(connectedPosition, remote);
      if (remote && !same(current, remote) && !navigation) { showConflict(remote, revision, current); return; }
      if (!remote && connectedPosition?.releaseId && connectedOwner !== uid) { showConflict(null, revision, current); return; }
      conflict = null;
      if ((!remote || !same(current, remote)) && canSync()) {
        desired = write(current, revision); if (!desired) return; later();
      }
      connectedPosition = remote || current; connectedOwner = uid;
      emit(desired ? 'pending' : remote ? 'saved' : 'ready');
    } catch { if (token === epoch) { emit('offline'); timer = schedule(connect, retry); retry = Math.min(30000, retry * 2); } }
  }
  async function chooseLocal() {
    if (!conflict || !uid || !canSync()) return;
    const local = conflict.local;
    applying = true;
    try {
      if (!same(getPosition(), local) && onRemote(local, uid) === false) { emit('storage'); return; }
    } finally { applying = false; }
    // Explicit reader choice, never an automatic rebase of a conflict.
    const next = write(local, revision);
    if (!next) return;
    for (const old of records()) if (old.key !== next.key) remove(old);
    pending = next; desired = null; conflict = null;
    await flush();
  }
  function chooseRemote() {
    if (!conflict?.remote || !uid || !canSync()) return;
    applying = true;
    try { if (onRemote(conflict.remote, uid) === false) { emit('storage'); return; } }
    finally { applying = false; }
    for (const old of records()) remove(old);
    observed = conflict.remote; connectedPosition = conflict.remote; connectedOwner = uid;
    pending = null; desired = null; conflict = null;
    emit('saved');
  }
  return { connect, note, flush, chooseLocal, chooseRemote, userId: () => uid,
    isReady: () => Boolean(uid && ready && !conflict && !stopped),
    stop() { ++epoch; cancel(timer); ready = false; } };
}),
    onResize: function () {
      var wasApplying = applyingSync; applyingSync = true;
      try { layout(true); } finally { applyingSync = wasApplying; }
    },
    onRemote: function (row, uid) {
      if (!editionPolicy.validId(row.releaseId) || !Number.isInteger(row.chapter) || row.chapter < 0 || row.chapter > 500) return false;
      var sameEdition = row.releaseId === releaseId;
      if (sameEdition && row.chapter >= titles.length) return false;
      var href = sameEdition ? chapterHref(row.chapter) : '../../releases/' + row.releaseId + '/ch-' + (row.chapter + 1) + '.html';
      var next = Object.assign({}, row, { href: href, readerUserId: uid });
      try {
        var old = localStorage.getItem(key);
        if (old) {
          var backupKey = 'historyai.reader-recovery.' + data.bookId + '.' + Date.now();
          localStorage.setItem(backupKey, old);
          if (localStorage.getItem(backupKey) !== old) return false;
        }
        localStorage.setItem(key, JSON.stringify(next));
        if (localStorage.getItem(key) !== JSON.stringify(next)) return false;
      } catch (e) { return false; }
      if (!sameEdition || row.chapter !== Number(data.chapter)) {
        applyingSync = true; location.assign(href); return true;
      }
      applyingSync = true;
      try {
        state.anchor = row.anchor || null; state.page = row.page || 0;
        if (state.mode === 'page') {
          var target = row.anchor && readerLocation.pageFor(row.anchor, step);
          go(target != null ? target : state.page, Boolean(target != null));
        } else if (!row.anchor || !restoreScrollAnchor(row.anchor)) window.scrollTo({ top: 0, behavior: 'instant' });
      } finally { applyingSync = false; }
      return true;
    }
  });
})();
