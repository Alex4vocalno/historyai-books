/* global window, Image */
(function () {
  'use strict';
  window.HAI_BOOKMARK_CANVAS = function (data) {
  function wrapText(ctx, text, maxWidth) {
    // v4.95：英文按单词断行（逐字符断会把单词拦腰截断），中文仍逐字
    var enWrap = String(data.lang || '').indexOf('en') === 0 && / /.test(text);
    var units = enWrap ? String(text).split(/(\s+)/) : String(text);
    var lines = [], line = '';
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var probe = line + u;
      if (ctx.measureText(probe).width > maxWidth && line) { lines.push(line.replace(/\s+$/, '')); line = u === ' ' ? '' : u; }
      else line = probe;
    }
    if (line) lines.push(line.replace(/\s+$/, ''));
    return lines;
  }

  function loadCover() {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = 'cover.jpg'; // 章节页与封面同目录；无封面书自然落到 onerror
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

    return { wrapText: wrapText, loadCover: loadCover, roundRect: roundRect };
  };
})();

/* ================================================================
 * EVORON AI 书城 · 阅读书签（v4.70）
 * 选中正文 → 浮出 🔖书签 / 💬想法 / ✏️划线 三颗按钮；书签再生成手机分辨率
 * 书签图（金句 + 书名 + 二维码）→ 保存/分享。想法与划线的面板在 reader.js，
 * 触发它们的浮钮在这里，所以本文件的到场时机决定整条划线链路的到场时机。
 *
 * v6.69 按需加载：本文件不再随每个章节页静态加载，改由 reader.js 里的
 * bookmark-loader 在首次 selection 时注入（见 assets-src/bookmark-loader.js）；
 * 载入即补一次 onSelection()，接住那次触发加载的选区。vendor 的 QR 生成器
 * （57KB）另拆到 bookmark-qr.js，只在真的点开书签图时才拉。
 * ================================================================ */
(function () {
  if (typeof document === 'undefined') return;
  if (window.__haiBookmarkReady) return; // 过渡期：老页面里的静态标签已经跑过一遍
  var dataEl = document.getElementById('reader-data');
  if (!dataEl) return;
  var data = {};
  try { data = JSON.parse(dataEl.textContent || '{}'); } catch (e) { return; }
  if (data.kind !== 'chapter') return;
  var content = null;

  var fab = document.createElement('button');
  fab.type = 'button';
  function ui(zh, en) { return window.EvoronReaderLanguage.text(zh, en); }
  fab.dataset.readerUi = '';
  fab.textContent = ui('🔖 书签', '🔖 Bookmark');
  // v4.97 想法按钮（对标微信读书划线想法）：与书签共用选择检测
  var ideaBtn = document.createElement('button');
  ideaBtn.type = 'button';
  ideaBtn.dataset.readerUi = '';
  ideaBtn.textContent = ui('💬 想法', '💬 Thought');
  ideaBtn.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(calc(-50% + 124px));z-index:80;display:none;min-height:44px;padding:0 18px;border:0;border-radius:22px;background:#3b6ea5;color:#fff;font:15px -apple-system,"PingFang SC",sans-serif;font-weight:700;box-shadow:0 8px 24px rgba(30,70,110,.4);cursor:pointer';
  ideaBtn.onclick = function () {
    var quote = currentQuote;
    if (!quote) return;
    var para = 0;
    try {
      var sel = window.getSelection();
      var node = sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
      var el = node && (node.nodeType === 1 ? node : node.parentNode);
      while (el && el.tagName !== 'P') el = el.parentNode;
      if (el) {
        var ps = document.querySelectorAll('.reader-content p');
        for (var i = 0; i < ps.length; i++) if (ps[i] === el) { para = i; break; }
      }
    } catch (e0) {}
    if (window.__haiIdeaCompose) window.__haiIdeaCompose(quote, para);
    fab.style.display = 'none';
    ideaBtn.style.display = 'none';
    hlBtn.style.display = 'none';
  };
  document.body.appendChild(ideaBtn);
  // v6.9.26 纯划线（微信读书向）：选中即划，不强制写想法；成功后阅读器重绘下划线
  var hlBtn = document.createElement('button');
  hlBtn.type = 'button';
  hlBtn.dataset.readerUi = '';
  hlBtn.textContent = ui('✏️ 划线', '✏️ Underline');
  hlBtn.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(calc(-50% + 8px));z-index:80;display:none;min-height:44px;padding:0 18px;border:0;border-radius:22px;background:#8a6a2f;color:#fff;font:15px -apple-system,"PingFang SC",sans-serif;font-weight:700;box-shadow:0 8px 24px rgba(110,85,30,.4);cursor:pointer';
  hlBtn.onclick = function () {
    var quote = currentQuote;
    if (!quote) return;
    var para = captureParaIndex();
    fetch('/api/book/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ bookId: data.bookId, chapter: Number(data.chapter) + 1, para: para, quote: quote, text: '' })
    }).then(function (r) { return r.json(); }).then(function (d2) {
      if (d2 && d2.ok) {
        try { window.getSelection().removeAllRanges(); } catch (e1) {}
        if (window.__haiNotesRefresh) window.__haiNotesRefresh();
      } else alert(ui('登录后才能划线', 'Sign in to underline'));
    }).catch(function () { alert(ui('网络异常，稍后再试', 'Network error')); });
    fab.style.display = 'none';
    ideaBtn.style.display = 'none';
    hlBtn.style.display = 'none';
  };
  document.body.appendChild(hlBtn);
  fab.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:80;display:none;min-height:44px;padding:0 22px;border:0;border-radius:22px;background:#0a9b6d;color:#fff;font:15px -apple-system,"PingFang SC",sans-serif;font-weight:700;box-shadow:0 8px 24px rgba(7,120,85,.4);cursor:pointer';
  document.body.appendChild(fab);

  var currentQuote = '';
  var currentPara = 0;
  // v5.87 三款高级书签（用户定案：提供 2-3 种书签设计和保存）——素笺/夜阑/朱批
  var BM_STYLES = [
    { id: 'sujian', zh: '素笺', en: 'Paper', paper: '#f6efe2', ink: '#2b2620', muted: '#8a8172', gold: '#a8873f', band: '#152420', bandInk: '#f2ead8', vignette: 'rgba(60,45,20,' },
    { id: 'yelan', zh: '夜阑', en: 'Night', paper: '#14181d', ink: '#e8e3d5', muted: '#8d9299', gold: '#c8a55b', band: '#0b0e12', bandInk: '#e9e2cf', vignette: 'rgba(0,0,0,' },
    { id: 'zhupi', zh: '朱批', en: 'Cinnabar', paper: '#b5382e', ink: '#f9efdd', muted: '#ecc9b4', gold: '#e9c97b', band: '#5f1b14', bandInk: '#f6e8cd', vignette: 'rgba(60,8,4,' }
  ];
  var bmStyle = BM_STYLES[0];
  try {
    var savedStyle = localStorage.getItem('historyai.bm.style');
    for (var bs = 0; bs < BM_STYLES.length; bs++) if (BM_STYLES[bs].id === savedStyle) bmStyle = BM_STYLES[bs];
  } catch (eS) {}
  function captureParaIndex() {
    var para = 0;
    try {
      var sel = window.getSelection();
      var node = sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
      var el = node && (node.nodeType === 1 ? node : node.parentNode);
      while (el && el.tagName !== 'P') el = el.parentNode;
      if (el) {
        var ps = document.querySelectorAll('.reader-content p');
        for (var i = 0; i < ps.length; i++) if (ps[i] === el) { para = i; break; }
      }
    } catch (e0) {}
    return para;
  }
  function onSelection() {
    var sel = window.getSelection();
    var text = sel ? String(sel.toString()).replace(/\s+/g, ' ').trim() : '';
    if (!content) content = document.querySelector('.reader-content');
    var inside = false;
    if (text && sel.rangeCount) {
      var node = sel.getRangeAt(0).commonAncestorContainer;
      inside = content ? content.contains(node.nodeType === 1 ? node : node.parentNode) : false;
    }
    if (inside && text.length >= 4 && text.length <= 220) {
      currentQuote = text;
      currentPara = captureParaIndex();
      fab.style.display = 'block';
      ideaBtn.style.display = 'block';
      hlBtn.style.display = 'block';
      fab.style.transform = 'translateX(calc(-50% - 116px))';
    } else if (!text) {
      fab.style.display = 'none';
      ideaBtn.style.display = 'none';
      hlBtn.style.display = 'none';
    }
  }
  document.addEventListener('selectionchange', function () { setTimeout(onSelection, 60); });
  onSelection(); // 按需加载时，触发加载的那次 selectionchange 已经过去了，补一次
  window.__haiBookmarkReady = true;

  // v6.69 QR 按需拉取：只有点开书签图才需要 vendor 那 57KB。资产基路径优先取
  // 本脚本自己的 src（注入时 currentScript 可用），其次用加载器留下的基路径。
  var ASSET_BASE = (function () {
    try {
      var self2 = document.currentScript;
      if (self2 && self2.src) return self2.src.replace(/[^/]*$/, '');
    } catch (eB0) {}
    return String(window.__haiAssetBase || '');
  })();
  var qrPending = null;
  function ensureQr() {
    if (typeof qrcode === 'function') return Promise.resolve(true);
    if (qrPending) return qrPending;
    qrPending = new Promise(function (resolve) {
      var el = document.createElement('script');
      el.src = ASSET_BASE + 'bookmark-qr.js';
      el.async = true;
      el.onload = function () { resolve(typeof qrcode === 'function'); };
      el.onerror = function () { qrPending = null; resolve(false); }; // 失败可重试
      document.head.appendChild(el);
    });
    return qrPending;
  }

  var canvasTools = window.HAI_BOOKMARK_CANVAS(data);
  var wrapText = canvasTools.wrapText, loadCover = canvasTools.loadCover, roundRect = canvasTools.roundRect;

  function bookUrl() {
    try { return new URL((data.links && data.links.detail) || 'index.html', location.href).href; }
    catch (e) { return location.href; }
  }

  function renderBookmark(cover, style) {
    style = style || bmStyle;
    var W = 1080, H = 1920;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var serif = String(data.lang || '').indexOf('en') === 0 ? 'Georgia,"Times New Roman",serif' : '"Songti SC","Noto Serif SC",Georgia,serif';
    var sans = '-apple-system,"PingFang SC",sans-serif';
    var INK = style.ink, MUTED = style.muted, GOLD = style.gold, PAPER = style.paper, DARK = style.band;
    // 纸面 + 晕影
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, style.vignette + '0)');
    vg.addColorStop(1, style.vignette + '.12)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // 双细金框
    ctx.strokeStyle = GOLD; ctx.globalAlpha = .75; ctx.lineWidth = 3;
    ctx.strokeRect(42, 42, W - 84, H - 84);
    ctx.globalAlpha = .35; ctx.lineWidth = 1.5;
    ctx.strokeRect(58, 58, W - 116, H - 116); ctx.globalAlpha = 1;
    // 品牌小字
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = '600 27px ' + sans;
    var EN = String(data.lang || '').indexOf('en') === 0;
    ctx.fillText(EN ? 'E V O R O N   A I   B O O K S' : 'E V O R O N   A I   书 城', W / 2, 146);
    // ── 封面（居中） ──
    var y = 210;
    if (cover) {
      var cw = 158, chh = 237, cx = (W - cw) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(40,28,8,.4)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
      roundRect(ctx, cx, y, cw, chh, 8); ctx.fillStyle = '#e4dccb'; ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, cx, y, cw, chh, 8); ctx.clip();
      var sc = Math.max(cw / cover.width, chh / cover.height);
      ctx.drawImage(cover, cx + (cw - cover.width * sc) / 2, y + (chh - cover.height * sc) / 2, cover.width * sc, cover.height * sc);
      ctx.restore();
      ctx.strokeStyle = GOLD; ctx.globalAlpha = .5; ctx.lineWidth = 1.5;
      roundRect(ctx, cx, y, cw, chh, 8); ctx.stroke(); ctx.globalAlpha = 1;
      y += chh + 78;
    } else {
      y += 60;
    }
    // ── 书名 / 作者（居中） ──
    ctx.fillStyle = INK;
    ctx.font = '700 54px ' + serif;
    var tLines = wrapText(ctx, String(data.title || ''), W - 260);
    if (tLines.length > 2) { tLines = tLines.slice(0, 2); tLines[1] += '…'; }
    for (var t = 0; t < tLines.length; t++) { ctx.fillText(tLines[t], W / 2, y); y += 72; }
    if (data.author) {
      ctx.fillStyle = MUTED; ctx.font = '30px ' + sans;
      ctx.fillText(EN ? 'by ' + String(data.author) : String(data.author) + ' 著', W / 2, y + 8); y += 52;
    }
    // 装饰分隔：细线 ◆ 细线
    y += 44;
    ctx.strokeStyle = GOLD; ctx.globalAlpha = .6; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 190, y); ctx.lineTo(W / 2 - 34, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 34, y); ctx.lineTo(W / 2 + 190, y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = GOLD; ctx.font = '22px ' + sans;
    ctx.fillText('\u25c6', W / 2, y + 8);
    // ── 金句（居中，自适应字号，保证完整） ──
    var bandTop = H - 262;
    var areaTop = y + 60, areaH = bandTop - 60 - areaTop;
    // v4.83 段落继承（用户反馈：选段被挤成一坨）：保留原文换行，段间留空
    var paraTexts = String(currentQuote || '').split(/\n+/).map(function (t) { return t.trim(); }).filter(Boolean);
    if (!paraTexts.length) paraTexts = [''];
    var sizes = [ [54, 94], [48, 84], [42, 74], [36, 64] ];
    var paraLines = [], lh = 84, fs = 48, gap = 0, totalH = 0;
    for (var si = 0; si < sizes.length; si++) {
      fs = sizes[si][0]; lh = sizes[si][1]; gap = Math.round(lh * 0.55);
      ctx.font = fs + 'px ' + serif;
      paraLines = paraTexts.map(function (t) { return wrapText(ctx, t, W - 280); });
      var n = 0;
      for (var pi = 0; pi < paraLines.length; pi++) n += paraLines[pi].length;
      totalH = n * lh + (paraLines.length - 1) * gap;
      if (totalH <= areaH - 90) break;
    }
    // 超限截断：从末段开始砍行
    var budget = Math.max(3, Math.floor((areaH - 90 - (paraLines.length - 1) * gap) / lh));
    var count = paraLines.reduce(function (a, l) { return a + l.length; }, 0);
    while (count > budget && paraLines.length) {
      var lastP = paraLines[paraLines.length - 1];
      lastP.pop();
      if (!lastP.length) { paraLines.pop(); }
      count--;
    }
    if (paraLines.length) {
      var lp = paraLines[paraLines.length - 1];
      if (lp.length && count < paraTexts.join('').length / 8) lp[lp.length - 1] += '…';
    }
    totalH = count * lh + (paraLines.length - 1) * gap;
    var q0 = areaTop + Math.max(0, (areaH - totalH) / 2) + 50;
    ctx.fillStyle = GOLD; ctx.globalAlpha = .85;
    ctx.font = '700 120px ' + serif;
    ctx.fillText('\u201c', W / 2, q0 - 34); ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.font = fs + 'px ' + serif;
    var qy0 = q0 + 60;
    for (var p2 = 0; p2 < paraLines.length; p2++) {
      for (var li = 0; li < paraLines[p2].length; li++) { ctx.fillText(paraLines[p2][li], W / 2, qy0); qy0 += lh; }
      qy0 += gap;
    }
    // ── 底部深色带：只留二维码与引导语，不放网址 ──
    ctx.fillStyle = DARK;
    ctx.fillRect(58, bandTop, W - 116, H - 58 - bandTop);
    var url = bookUrl();
    var q = qrcode(0, 'M'); q.addData(url); q.make();
    var n = q.getModuleCount();
    var qsize = 136, cell = qsize / n;
    var qx = W - 150 - qsize, qy2 = bandTop + Math.round((H - 58 - bandTop - qsize) / 2);
    ctx.fillStyle = '#fff';
    roundRect(ctx, qx - 12, qy2 - 12, qsize + 24, qsize + 24, 10); ctx.fill();
    ctx.fillStyle = '#111';
    for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (q.isDark(r, col)) ctx.fillRect(qx + col * cell, qy2 + r * cell, Math.ceil(cell), Math.ceil(cell));
    ctx.textAlign = 'left';
    ctx.fillStyle = style.bandInk; ctx.font = '600 36px ' + sans;
    ctx.fillText(EN ? 'Scan to keep reading' : '扫码继续阅读全书', 150, bandTop + 104);
    ctx.globalAlpha = .62; ctx.fillStyle = style.bandInk; ctx.font = '26px ' + sans;
    ctx.fillText(EN ? 'EVORON AI Books · Every reader is a writer' : 'EVORON AI 书城 · 每一位读者也是作者', 150, bandTop + 158); ctx.globalAlpha = 1;
    return c;
  }

  function openOverlay() {
    loadCover().then(function (cover) {
      var canvas;
      try { canvas = renderBookmark(cover, bmStyle); } catch (e) { return; }
      var dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      var savedQuote = currentQuote, savedPara = currentPara;
      var wrap = document.createElement('div');
      wrap.dataset.readerUi = '';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(14,17,15,.82);padding:20px';
      var img = document.createElement('img');
      img.src = dataUrl;
      img.alt = '书签';
      img.style.cssText = 'max-height:64vh;max-width:88vw;border-radius:10px;box-shadow:0 24px 70px rgba(0,0,0,.5)';
      // v5.87 三款风格页签：点选即重绘，选择记忆到本地
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:flex;gap:8px';
      BM_STYLES.forEach(function (st) {
        var tb = document.createElement('button');
        tb.type = 'button'; tb.textContent = ui(st.zh, st.en);
        tb.dataset.bmStyle = st.id;
        tb.style.cssText = 'min-height:34px;padding:0 16px;border:1px solid rgba(255,255,255,.3);border-radius:17px;font:13px -apple-system,"PingFang SC",sans-serif;font-weight:700;cursor:pointer;background:' + (st.id === bmStyle.id ? '#fff' : 'transparent') + ';color:' + (st.id === bmStyle.id ? '#111' : '#fff');
        tb.onclick = function () {
          bmStyle = st;
          try { localStorage.setItem('historyai.bm.style', st.id); } catch (e5) {}
          try { canvas = renderBookmark(cover, st); dataUrl = canvas.toDataURL('image/jpeg', 0.9); img.src = dataUrl; } catch (e6) {}
          tabs.querySelectorAll('button').forEach(function (b2) {
            var on = b2.dataset.bmStyle === st.id;
            b2.style.background = on ? '#fff' : 'transparent';
            b2.style.color = on ? '#111' : '#fff';
          });
        };
        tabs.appendChild(tb);
      });
      var hint = document.createElement('p');
      hint.textContent = ui('手机可长按图片保存到相册', 'Long-press the image to save it');
      hint.style.cssText = 'margin:0;color:#cfd6d1;font:13px -apple-system,"PingFang SC",sans-serif';
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px';
      function btn(label, primary) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = label;
        b.style.cssText = 'min-height:42px;padding:0 20px;border:0;border-radius:21px;font:14px -apple-system,"PingFang SC",sans-serif;font-weight:700;cursor:pointer;' + (primary ? 'background:#0a9b6d;color:#fff' : 'background:rgba(255,255,255,.14);color:#fff');
        return b;
      }
      var save = btn(ui('保存图片', 'Save image'), true);
      save.onclick = function () {
        var a = document.createElement('a');
        a.href = dataUrl; a.download = (data.title || '书签') + '-书签.jpg';
        document.body.appendChild(a); a.click(); a.remove();
      };
      // v5.87 存书签（云同步，匿名落本地）：登录读者 POST 云端，401 回落 localStorage
      var keep = btn(ui('存入书签', 'Keep bookmark'), false);
      keep.onclick = function () {
        var row = { bookId: data.bookId || '', bookTitle: data.title || '', chapter: Number(data.chapter) || 0, para: savedPara, quote: savedQuote, style: bmStyle.id };
        function localFallback() {
          try {
            var all = JSON.parse(localStorage.getItem('historyai.bookmarks') || '[]');
            row.id = 'lbm_' + Date.now().toString(36);
            row.createdAt = new Date().toISOString();
            all.push(row);
            localStorage.setItem('historyai.bookmarks', JSON.stringify(all.slice(-200)));
            keep.textContent = ui('✓ 已存本机（登录可云同步）', '✓ Saved on this device');
          } catch (e7) { keep.textContent = ui('保存失败', 'Save failed'); }
          keep.disabled = true;
        }
        fetch('/api/reader/bookmarks', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) })
          .then(function (r) { if (r.status === 401) { localFallback(); return null; } return r.json(); })
          .then(function (d) { if (d && d.ok) { keep.textContent = ui('✓ 已存入书签', '✓ Bookmarked'); keep.disabled = true; } else if (d) { localFallback(); } })
          .catch(localFallback);
      };
      var share = btn(ui('分享', 'Share'), false);
      if (navigator.share && navigator.canShare) {
        share.onclick = function () {
          canvas.toBlob(function (blob) {
            if (!blob) return;
            var file = new File([blob], '书签.jpg', { type: 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: data.title || '书签' }).catch(function () {});
          }, 'image/jpeg', 0.9);
        };
      } else { share.style.display = 'none'; }
      var close = btn(ui('关闭', 'Close'), false);
      close.onclick = function () { wrap.remove(); };
      wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
      row.appendChild(save); row.appendChild(keep); row.appendChild(share); row.appendChild(close);
      wrap.appendChild(img); wrap.appendChild(tabs); wrap.appendChild(hint); wrap.appendChild(row);
      document.body.appendChild(wrap);
      fab.style.display = 'none';
      ideaBtn.style.display = 'none';
      hlBtn.style.display = 'none';
    });
  }
  // QR 没到手就不画：书签图的底带靠它，缺了只会出一张残图。拉不动就照常提示重试。
  fab.addEventListener('click', function () {
    ensureQr().then(function (ok) {
      if (ok) openOverlay();
      else alert(ui('网络异常，稍后再试', 'Network error'));
    });
  });
})();
