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
  var homeHref = L.home || '';
  var detailHref = L.detail || '';

  var progress = h('div', 'read-progress', '<span></span>');
  var tools = ''
    + '<button class="icon-button text" type="button" data-toggle-settings title="字体与排版">字体</button>'
    + (detailHref ? '<a class="icon-button text" href="' + esc(detailHref) + '" title="回到本书封面">封面</a>' : '')
    + (homeHref ? '<a class="icon-button text" href="' + esc(homeHref) + '" title="返回书库">书库</a>' : '');
  var bar = h('header', 'reader-bar', '<div class="reader-bar-inner">'
    + '<div class="reader-bar-left">'
    + (titles.length ? '<button class="icon-button text" type="button" data-toggle-drawer>目录</button>' : '')
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
    drawer = h('aside', 'chapter-drawer', '<div class="drawer-head"><strong>目录</strong><span>' + titles.length + ' 章'
      + (isChapter ? ' · 当前第 ' + (Number(data.chapter) + 1) + ' 章' : '') + '</span></div><nav class="chapter-list">' + rows + '</nav>');
  }

  var settings = h('section', 'settings', '<strong>阅读设置</strong>'
    + '<div class="setting-row"><label>翻页</label><div class="segments"><button type="button" data-setting="mode" data-value="page">翻页</button><button type="button" data-setting="mode" data-value="scroll">滚动</button></div></div>'
    + '<div class="setting-row"><label>主题</label><div class="segments"><button type="button" data-setting="theme" data-value="paper">纸张</button><button type="button" data-setting="theme" data-value="white">白色</button><button type="button" data-setting="theme" data-value="night">夜间</button></div></div>'
    + '<div class="setting-row"><label>字号</label><div class="stepper"><button type="button" data-font-step="-1">−</button><span data-font-value>18 px</span><button type="button" data-font-step="1">＋</button></div></div>'
    + '<div class="setting-row"><label>行距</label><div class="segments"><button type="button" data-setting="leading" data-value="1.75">紧凑</button><button type="button" data-setting="leading" data-value="2">舒适</button><button type="button" data-setting="leading" data-value="2.2">宽松</button></div></div>'
    + '<div class="setting-row"><label>版心</label><div class="segments"><button type="button" data-setting="width" data-value="680">窄</button><button type="button" data-setting="width" data-value="760">中</button><button type="button" data-setting="width" data-value="860">宽</button></div></div>');
  settings.hidden = true;
  var mask = h('div', 'drawer-mask');

  var shell = document.querySelector('.reader-shell');
  document.body.insertBefore(progress, document.body.firstChild);
  document.body.insertBefore(bar, progress.nextSibling);
  if (drawer && shell) shell.insertBefore(drawer, shell.firstChild);
  document.body.appendChild(mask);
  document.body.appendChild(settings);

  // 底部章间导航（翻页模式下由 CSS 隐藏；滚动模式与无脚本回退时可用）
  var navHost = document.querySelector('[data-chapter-nav]');
  if (navHost && isChapter) {
    var prev = Number(data.chapter) > 0 ? '<a href="' + esc(chapterHref(Number(data.chapter) - 1)) + '">上一章</a>' : '<span></span>';
    var next = Number(data.chapter) + 1 < titles.length ? '<a href="' + esc(chapterHref(Number(data.chapter) + 1)) + '">下一章</a>' : '<span></span>';
    navHost.innerHTML = prev + '<span class="nav-home">'
      + (detailHref ? '<a href="' + esc(detailHref) + '">封面</a>' : '')
      + (homeHref ? '<a href="' + esc(homeHref) + '">书库</a>' : '')
      + '</span>' + next;
  }

  if (!isChapter) return; // 起始页只要外壳，不跑分页逻辑

  // ---- 阅读行为：翻页排版 / 设置 / 进度记忆 ----
  var key = 'historyai.reader.' + data.bookId;
  var state = { theme: 'paper', font: 18, leading: 2, width: 760, mode: 'page', chapter: 0, page: 0, href: '' };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(key) || '{}')); } catch (e) { /* 首次阅读 */ }
  if (state.mode !== 'scroll') state.mode = 'page';
  // v4.86 系统夜间模式：用户从未手选主题时跟随系统配色，且随系统切换实时变
  var mqDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  if (!state.themeChosen && mqDark) {
    state.theme = mqDark.matches ? 'night' : 'paper';
    if (mqDark.addEventListener) mqDark.addEventListener('change', function (ev2) {
      if (state.themeChosen) return;
      state.theme = ev2.matches ? 'night' : 'paper';
      apply();
    });
  }
  var flow = document.querySelector('.flow-inner');
  var paper = document.querySelector('.reader-paper');
  var flowBox = document.querySelector('.paper-flow');
  var page = 0, total = 1, step = 1;
  var prevHref = Number(data.chapter) > 0 ? chapterHref(Number(data.chapter) - 1) : '';
  var nextHref = Number(data.chapter) + 1 < titles.length ? chapterHref(Number(data.chapter) + 1) : '';

  function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* 隐私模式 */ } }
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
    if (r >= 0.5) trackOnce('half');
    if (r >= 0.98) trackOnce('finish');
  }
  function indicator() {
    var el2 = document.querySelector('.page-indicator'); if (el2) el2.textContent = (page + 1) + ' / ' + total + ' 页';
    var loc = document.querySelector('.reader-location');
    if (loc && state.mode === 'page') loc.textContent = chapterLabel + ' · ' + (data.chapterTitle || '') + ' · ' + (page + 1) + '/' + total + ' 页';
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
  function apply() {
    root.dataset.theme = state.theme;
    root.style.setProperty('--reader-font', state.font + 'px');
    root.style.setProperty('--reader-leading', state.leading);
    root.style.setProperty('--reader-width', state.width + 'px');
    document.querySelectorAll('[data-setting]').forEach(function (b) { b.classList.toggle('active', String(state[b.dataset.setting]) === b.dataset.value); });
    var f = document.querySelector('[data-font-value]'); if (f) f.textContent = state.font + ' px';
  }
  function scrollProgress() {
    if (state.mode === 'page') return;
    var totalH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    setBar(scrollY / totalH);
  }

  var sameChapter = Number(state.chapter) === Number(data.chapter);
  state.chapter = Number(data.chapter);
  state.href = new URL(L.self || location.pathname.split('/').pop(), location.href).href;
  state.chapterTitle = data.chapterTitle;
  state.updatedAt = new Date().toISOString();
  save(); apply();
  trackOnce('open');

  document.querySelectorAll('[data-setting]').forEach(function (b) {
    b.addEventListener('click', function () {
      var name = b.dataset.setting, value = b.dataset.value;
      state[name] = (name === 'width' || name === 'leading') ? Number(value) : value;
      if (name === 'theme') state.themeChosen = true; // 手选后不再跟随系统
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
  if (drawerToggle) drawerToggle.addEventListener('click', function () { document.body.classList.toggle('drawer-open'); });
  mask.addEventListener('click', function () { document.body.classList.remove('drawer-open'); });
  addEventListener('scroll', scrollProgress, { passive: true });

  if (paper) {
    paper.addEventListener('click', function (e) {
      if (state.mode !== 'page') return;
      if (e.target.closest && e.target.closest('a,button')) return;
      var x = e.clientX, w = innerWidth;
      if (x < w * 0.3) flip(-1); else if (x > w * 0.7) flip(1);
    });
    var tx = null, ty = null;
    paper.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } }, { passive: true });
    paper.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
      if (state.mode === 'page' && Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) flip(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); flip(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flip(-1); }
  });
  // v4.86 触摸翻页（第一期）：横滑 >56px 翻页；轻点屏幕左右 22% 区域翻页。
  // 选中文字（书签流程）、点在链接/按钮上、滚动模式一律不劫持。
  var tx = 0, ty = 0, tt = 0;
  addEventListener('touchstart', function (e) {
    if (!e.touches || e.touches.length !== 1) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
  }, { passive: true });
  addEventListener('touchend', function (e) {
    if (state.mode !== 'page') return;
    var c = e.changedTouches && e.changedTouches[0]; if (!c) return;
    try { if (window.getSelection && String(window.getSelection())) return; } catch (e4) {}
    var el5 = e.target;
    while (el5 && el5 !== document.body) {
      if (el5.tagName === 'A' || el5.tagName === 'BUTTON' || el5.tagName === 'INPUT' || el5.tagName === 'LABEL') return;
      el5 = el5.parentNode;
    }
    var dx = c.clientX - tx, dy = c.clientY - ty, dt = Date.now() - tt;
    if (dt < 600 && Math.abs(dx) > 56 && Math.abs(dy) < 48) { flip(dx < 0 ? 1 : -1); return; }
    if (dt < 350 && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      var xr = c.clientX / innerWidth;
      if (xr < 0.22) flip(-1);
      else if (xr > 0.78) flip(1);
    }
  }, { passive: true });
  var rsz = null;
  addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { layout(true); }, 150); });
  layout(false);
  if (state.mode === 'page') {
    if (location.hash === '#last') go(total - 1);
    else if (sameChapter && Number.isFinite(Number(state.page))) go(Math.min(Number(state.page), total - 1));
  }
  addEventListener('load', function () { setTimeout(function () { layout(true); }, 80); });
})();
