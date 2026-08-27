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
        ? /[^.!?]*[.!?]+["')]]*s*|[^.!?]+$/g
        : /[^。！？；…]*[。！？；…]+[」』”’】)]]*|[^。！？；…]+$/g;
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
        if ((en ? DIS_EN : DIS_ZH).test(sen[bi + 1].replace(/^s+/, ''))) attract[bi] += 2.2;
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
    + (detailHref ? '<a class="icon-button text" href="' + esc(detailHref) + '" title="回到本书封面">封面</a>' : '')
    + loc('<a class="icon-button text" href="/shelf.html" title="我的书架">书架</a>')
    + (homeHref ? loc('<a class="icon-button text" href="' + esc(homeHref) + '" title="返回书库">书库</a>') : '');
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
      + (isChapter ? ' · 当前第 ' + (Number(data.chapter) + 1) + ' 章' : '') + '</span></div><nav class="chapter-list">' + rows + '</nav>'));
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

  // v4.87 旧版本自动刷新（用户定调）：本页 release 与最新不一致时静默跳到
  // 最新版同章（章号超界收到末章）。每书每会话只跳一次防环。
  (function autoUpgradeRelease() {
    try {
      var segs0 = location.pathname.split('/');
      var bi0 = segs0.indexOf('books');
      if (bi0 < 0 || segs0[bi0 + 2] !== 'releases') return;
      var curRel = segs0[bi0 + 3];
      var guard = 'hai.upgraded.' + (data.bookId || segs0[bi0 + 1]);
      if (sessionStorage.getItem(guard)) return;
      fetch('../../release.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rel) {
        if (!rel || !rel.releaseId || rel.releaseId === curRel) return;
        sessionStorage.setItem(guard, '1');
        var chNo = Math.min(Number(data.chapter) + 1 || 1, Number(rel.chapterCount) || 1);
        location.replace('../../releases/' + rel.releaseId + '/ch-' + chNo + '.html');
      }).catch(function () { /* 网络失败按当前版本读 */ });
    } catch (e6) { /* 环境不支持则跳过 */ }
  })();

  // ---- 阅读行为：翻页排版 / 设置 / 进度记忆 ----
  var key = 'historyai.reader.' + data.bookId;
  var PREF_KEY = 'historyai.reader.settings';
  // v5.40 外观全局化（用户实弹：每次点阅读默认夜间）：外观（纸色/字体/字号/
  // 行距/版心/翻页）存全站 key，一次设定所有书生效；书级 key 只存进度。
  // 缺省一律纸张——不再跟随系统深色模式（v4.86 跟随逻辑就是夜间病灶）。
  var state = { theme: 'paper', face: 'serif', font: 18, leading: 2, width: 760, mode: 'page', chapter: 0, page: 0, href: '' };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* 首次阅读 */ }
  try {
    var prog0 = JSON.parse(localStorage.getItem(key) || '{}');
    // 老账迁移：手选过主题的读者把书级外观带进全站偏好（仅当全站偏好还没建立）
    if (prog0.themeChosen && !localStorage.getItem(PREF_KEY)) {
      ['theme', 'face', 'font', 'leading', 'width', 'mode'].forEach(function (k0) { if (prog0[k0] !== undefined) state[k0] = prog0[k0]; });
    }
    state.chapter = prog0.chapter || 0; state.page = prog0.page || 0; state.href = prog0.href || '';
  } catch (e) { /* 首次阅读 */ }
  if (state.mode !== 'scroll') state.mode = 'page';
  var flow = document.querySelector('.flow-inner');
  var paper = document.querySelector('.reader-paper');
  var flowBox = document.querySelector('.paper-flow');
  var page = 0, total = 1, step = 1, prefetched = false;
  var prevHref = Number(data.chapter) > 0 ? chapterHref(Number(data.chapter) - 1) : '';
  var nextHref = Number(data.chapter) + 1 < titles.length ? chapterHref(Number(data.chapter) + 1) : '';

  function save() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: state.theme, face: state.face, font: state.font, leading: state.leading, width: state.width, mode: state.mode })); } catch (e) { /* 隐私模式 */ }
    try { localStorage.setItem(key, JSON.stringify({ chapter: state.chapter, page: state.page, href: state.href, chapterTitle: state.chapterTitle, updatedAt: state.updatedAt })); } catch (e) { /* 隐私模式 */ }
    cloudPush();
  }
  // v4.87 进度云同步：登录读者换设备不丢书。探测一次身份，匿名整体跳过；
  // 写云节流 5s；云端进度更新且指向别章时静默接续（每书每会话只跳一次）。
  var cloudOn = false, cloudTimer = null;
  function cloudPush() {
    if (!cloudOn) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      try {
        fetch('/api/reader/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ bookId: data.bookId, releaseId: (location.pathname.split('/releases/')[1] || '').split('/')[0], chapter: Number(data.chapter) || 0, n: (titles && titles.length) || 0, page: Number(state.page) || 0, title: data.title || '', chapterTitle: data.chapterTitle || '' }),
        }).catch(function () {});
      } catch (e7) {}
    }, 5000);
  }
  try {
    fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
      if (!(me && me.ok && me.user)) return;
      cloudOn = true;
      return fetch('/api/reader/progress?bookId=' + encodeURIComponent(data.bookId), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d2) {
          var row = d2 && d2.row;
          if (!row) return;
          var localAt = String(state.updatedAt || '');
          var guard2 = 'hai.cloudjump.' + data.bookId;
          if (String(row.updatedAt) > localAt && Number(row.chapter) !== Number(data.chapter) && !sessionStorage.getItem(guard2)) {
            sessionStorage.setItem(guard2, '1');
            location.replace(chapterHref(Number(row.chapter)));
          }
        });
    }).catch(function () { /* 未登录/网络失败=本地模式 */ });
  } catch (e8) {}
  // v4.86 阅读埋点（第一期用户拍板：埋点先行）：open/half/finish 三事件，
  // 匿名 tid、sendBeacon 零阻塞、失败无感。数据落写作台 output/telemetry/。
  function track(ev) {
    try {
      var tid = localStorage.getItem('historyai.tid');
      if (!tid) { tid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('historyai.tid', tid); }
      var segs = location.pathname.split('/');
      var bIdx = segs.indexOf('books');
      var mb = bIdx >= 0 ? segs[bIdx + 1] : '';
      var mrel = (bIdx >= 0 && segs[bIdx + 2] === 'releases') ? segs[bIdx + 3] : '';
      var payload = JSON.stringify({ e: ev, b: data.bookId || mb || '', rel: mrel || '', c: Number(data.chapter) || 0, n: (titles && titles.length) || 0, tid: tid });
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
    if (r >= 0.9 && nextHref && !prefetched) {
      prefetched = true;
      var pl = document.createElement('link'); pl.rel = 'prefetch'; pl.href = nextHref; document.head.appendChild(pl);
    }
    if (r >= 0.98) {
      trackOnce('finish');
      // v5.12 读完自动标记（用户定调对齐微信读书）：末章读完即记书架「读完」
      if (!nextHref && cloudOn && !window.__haiMarkedFinished) {
        window.__haiMarkedFinished = true;
        fetch('/api/reader/shelf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: data.bookId, title: data.title || '', status: 'finished' }) }).then(function () {
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
    root.dataset.rmode = state.mode;
    if (state.mode !== 'page') { if (flow) { flow.style.columnWidth = ''; flow.style.columnGap = ''; flow.style.transform = ''; } scrollProgress(); return; }
    if (!flow || !flowBox) return;
    var ratio = total > 1 ? page / (total - 1) : 0;
    var cw = flowBox.clientWidth, gap = 48;
    flow.style.columnWidth = cw + 'px'; flow.style.columnGap = gap + 'px';
    step = cw + gap;
    total = Math.max(1, Math.round((flow.scrollWidth + gap) / step));
    go(keepRatio ? Math.round(ratio * (total - 1)) : Math.min(page, total - 1));
  }
  function go(n) {
    page = Math.max(0, Math.min(total - 1, n));
    if (flow) flow.style.transform = 'translate3d(-' + (page * step) + 'px,0,0)';
    setBar(total > 1 ? page / (total - 1) : 1); indicator(); state.page = page; save();
  }
  function flip(dir) {
    if (state.mode !== 'page') { scrollBy({ top: dir * (innerHeight * 0.88), behavior: 'smooth' }); return; }
    var n = page + dir;
    if (n < 0) { if (prevHref) location.href = prevHref + '#last'; return; }
    if (n > total - 1) { if (nextHref) location.href = nextHref; return; }
    go(n);
  }
  (function floatingReaderDock() {
    var prevText = data.lang === 'en' ? 'Prev' : '上一页';
    var nextText = data.lang === 'en' ? 'Next' : '下一页';
    var dock = h('div', 'reader-floating', '<button type="button" data-reader-prev>' + prevText + '</button><span data-reader-pct>0%</span><button type="button" data-reader-next>' + nextText + '</button>');
    document.body.appendChild(dock);
    dock.querySelector('[data-reader-prev]').addEventListener('click', function (e) { e.stopPropagation(); flip(-1); });
    dock.querySelector('[data-reader-next]').addEventListener('click', function (e) { e.stopPropagation(); flip(1); });
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
  function scrollProgress() {
    if (state.mode === 'page') return;
    var totalH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var r = scrollY / totalH;
    setBar(r);
    // v5.25 阅读体验深化：滚动模式同样显示本章剩余时间（此前只有翻页模式有）
    var loc2 = document.querySelector('.reader-location');
    if (loc2) loc2.textContent = chapterLabel + ' · ' + (data.chapterTitle || '') + ' · ' + remainText(r);
  }

  var sameChapter = Number(state.chapter) === Number(data.chapter);
  state.chapter = Number(data.chapter);
  state.href = new URL(L.self || location.pathname.split('/').pop(), location.href).href;
  state.chapterTitle = data.chapterTitle;
  state.updatedAt = new Date().toISOString();
  save(); apply();
  trackOnce('open');

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
  var toggle = document.querySelector('[data-toggle-settings]');
  if (toggle) toggle.addEventListener('click', function (e) { e.stopPropagation(); settings.hidden = !settings.hidden; });
  settings.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { if (!settings.hidden) settings.hidden = true; });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !settings.hidden) settings.hidden = true; });
  var drawerToggle = document.querySelector('[data-toggle-drawer]');
  if (drawerToggle) drawerToggle.addEventListener('click', function () { document.body.classList.toggle('drawer-open'); if (document.body.classList.contains('drawer-open')) defer(restoreTocScroll); });
  mask.addEventListener('click', function () { document.body.classList.remove('drawer-open'); });
  addEventListener('scroll', scrollProgress, { passive: true });

  // v4.98.1 点按翻页（Kindle 式）：左 1/3 上一页，其余下一页。轻点统一走 click
  // 通道——触屏轻点有合成 click、滑动没有，天然分流；滑动归下方 touch 通道独管。
  if (paper) {
    paper.addEventListener('click', function (e) {
      if (state.mode !== 'page') return;
      if (!settings.hidden || document.body.classList.contains('drawer-open')) return;
      var sheetEl = document.querySelector('.idea-sheet');
      if (sheetEl) { sheetEl.remove(); return; } // 想法面板开着：点正文=收起，不翻页
      if (e.target.closest && e.target.closest('a,button,input,textarea,label,.idea-dot,.review-box')) return;
      try { if (window.getSelection && String(window.getSelection())) return; } catch (e9) {}
      if (e.clientX < innerWidth / 3) flip(-1); else flip(1);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); flip(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flip(-1); }
  });
  // v4.86 触摸翻页→v4.98.1 收束：本通道只管横滑（>56px），轻点已归 click 通道。
  // 实弹教训：曾与 paper 触摸手势共用 var tx（函数级作用域相撞），先到的 touchend
  // 把坐标置 null，后到的算出假位移——右侧轻点被一退一进抵消成「点了没反应」。
  var swipeX = null, swipeY = 0, swipeT = 0;
  addEventListener('touchstart', function (e) {
    if (!e.touches || e.touches.length !== 1) { swipeX = null; return; }
    swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; swipeT = Date.now();
  }, { passive: true });
  addEventListener('touchend', function (e) {
    if (state.mode !== 'page' || swipeX === null) return;
    var c = e.changedTouches && e.changedTouches[0]; if (!c) return;
    var dx = c.clientX - swipeX, dy = c.clientY - swipeY, dt = Date.now() - swipeT;
    swipeX = null;
    if (dt >= 600 || Math.abs(dx) <= 56 || Math.abs(dy) >= 48) return;
    try { if (window.getSelection && String(window.getSelection())) return; } catch (e4) {}
    if (e.target.closest && e.target.closest('a,button,input,textarea,label,.settings,.chapter-drawer,.idea-sheet,.review-box')) return;
    flip(dx < 0 ? 1 : -1);
  }, { passive: true });
  var rsz = null;
  addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { layout(true); }, 150); });
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
    function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
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
    var notesCache = [];
    function refreshNotes() {
      fetch('/api/book/notes?bookId=' + encodeURIComponent(data.bookId) + '&chapter=' + (Number(data.chapter) + 1))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!(d && d.ok)) return;
          attachReplies(d.notes, d.replies);
          notesCache = d.notes;
          document.querySelectorAll('.idea-dot').forEach(function (x) { x.remove(); });
          var ps = document.querySelectorAll('.reader-content p');
          var byPara = {};
          d.notes.forEach(function (n) {
            var hit = -1;
            for (var i = 0; i < ps.length; i++) {
              if ((ps[i].textContent || '').indexOf(n.quote.slice(0, 60)) !== -1) { hit = i; break; }
            }
            n._para = hit;
            (byPara[hit] = byPara[hit] || []).push(n);
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
      closeSheet();
      sheet = el2('div', 'idea-sheet');
      sheet.appendChild(el2('h4', '', T('想法', 'Thoughts') + ' · ' + notes2.length));
      sheet.appendChild(el2('p', 'idea-quote', notes2[0].quote));
      notes2.forEach(function (n) { renderItem(sheet, n, 'note', refreshAll); });
      if (!loggedIn2) loginHint(sheet);
      var x = el2('div', 'idea-act');
      var c = el2('span', '', T('关闭', 'Close'));
      c.onclick = closeSheet;
      x.appendChild(c);
      sheet.appendChild(x);
      document.body.appendChild(sheet);
    }
    function refreshAll() { closeSheet(); refreshNotes(); }
    // 想法作曲器（选择浮钮的 💬 调用）
    window.__haiIdeaCompose = function (quote, para) {
      closeSheet();
      sheet = el2('div', 'idea-sheet');
      sheet.appendChild(el2('h4', '', T('写想法', 'Add a thought')));
      sheet.appendChild(el2('p', 'idea-quote', quote));
      if (!loggedIn2) { loginHint(sheet); document.body.appendChild(sheet); return; }
      var row = el2('div', 'idea-input');
      var ta = document.createElement('textarea');
      ta.placeholder = T('这段文字让你想到什么…', 'What does this passage make you think…');
      var go = el2('button', '', T('发表', 'Post'));
      go.onclick = function () {
        var v = ta.value.trim();
        if (!v) return;
        post2('/api/book/notes', { bookId: data.bookId, chapter: Number(data.chapter) + 1, para: para, quote: quote, text: v })
          .then(function (r2) { if (r2 && r2.ok) refreshAll(); else alert((r2 && r2.error) || T('发表失败', 'Failed')); });
      };
      row.appendChild(ta); row.appendChild(go);
      sheet.appendChild(row);
      var x2 = el2('div', 'idea-act');
      var c2 = el2('span', '', T('关闭', 'Close'));
      c2.onclick = closeSheet;
      x2.appendChild(c2);
      sheet.appendChild(x2);
      document.body.appendChild(sheet);
      ta.focus();
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

  layout(false);
  if (state.mode === 'page') {
    if (location.hash === '#last') go(total - 1);
    else if (sameChapter && Number.isFinite(Number(state.page))) go(Math.min(Number(state.page), total - 1));
  }
  addEventListener('load', function () { setTimeout(function () { layout(true); }, 80); });
})();
