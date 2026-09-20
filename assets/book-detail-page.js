// 书籍详情页的页内逻辑。issue #5 之前这些是六段内联 <script>，严格 script-src 会
// 全部拦下；现在逻辑在这里，per-book 数据从页面上的
// <script type="application/json" id="evoron-book-data"> 读进来（JSON 块不执行，
// CSP 不拦它）。行为与内联版逐段等价，只是执行时机统一挪到 </main> 之后。
(function () {
  var node = document.getElementById('evoron-book-data');
  if (!node) return;
  var D;
  try { D = JSON.parse(node.textContent); } catch (e) { return; }
  var T = D.t || {};
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
