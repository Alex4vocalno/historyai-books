(function(){
  var EN=false;try{EN=window.EvoronLanguage?.state().language==='en'}catch(e){}
  function T(zh,en){return EN?en:zh}
  document.title=T('榜单 · EVORON AI电子书城','Charts · EVORON AI Bookstore');
  var backEl=document.querySelector('[data-t="back"]');backEl.textContent=T('← 返回书城','← Back to library');if(EN)backEl.href='/index-en.html';
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  // v6.9.40 榜单去机械化：飙升=近7天读者热度、巅峰/神作=贝叶斯加权（阅读量×评分）、
  // 新书=时间；热度接口失败或数据太薄时回落纯评分排序（fail-open 不许卡死）
  var BOARDS=[
    {k:'surging',t:T('飙升榜','Surging'),n:T('近 7 天读者热度上升最快的作品','Fastest-rising with readers over the last 7 days'),bg:'linear-gradient(120deg,#b8371f,#e08a2e)',orn:T('飙','S')},
    {k:'fresh',t:T('新书榜','New arrivals'),n:T('最近上架的新作品','The latest additions to the library'),bg:'linear-gradient(120deg,#0e7d63,#3db08a)',orn:T('新','N')},
    {k:'top',t:T('巅峰榜','All-time'),n:T('读者阅读量与编辑评分综合最高','Readership and editorial rating combined'),bg:'linear-gradient(120deg,#7a5410,#c9962b)',orn:T('巅','T')},
    {k:'master',t:T('编辑精选','Editorial picks'),n:T('编辑评分 8.5 分以上，结合阅读人数排序','Editorial scores of 8.5+, ranked with readership'),bg:'linear-gradient(120deg,#452a72,#8a5ec2)',orn:T('选','E')}
  ];
  var CAT_BG='linear-gradient(120deg,#2c3e38,#4a6a5d)';
  fetch('/books/index.json').then(function(r){return r.json()}).then(function(all){
    var rows=all.filter(function(b){return b&&b.visibility!=='unlisted'});
    var ids=rows.map(function(b){return b.projectId||b.id}).filter(Boolean);
    var chunks=[];for(var ci=0;ci<ids.length;ci+=80)chunks.push(ids.slice(ci,ci+80));
    Promise.all(chunks.map(function(ch){
      return fetch('/api/social/book-stats?ids='+ch.join(',')).then(function(r){return r.json()}).catch(function(){return null})
    })).then(function(parts){
      var stats={};parts.forEach(function(p){if(p&&p.stats)Object.keys(p.stats).forEach(function(k){stats[k]=p.stats[k]})});
      boot(rows,stats);
    }).catch(function(){boot(rows,{})});
  }).catch(function(){document.querySelector('[data-list]').innerHTML='<div class="empty">'+T('榜单暂时打不开，稍后再试。','Charts are unavailable right now.')+'</div>'});
  function boot(rows,stats){
    function scoreOf(b){return b.editorialScore&&Number(b.editorialScore.score)||0}
    function dateOf(b){return Date.parse(b.firstPublishedAt||b.publishedAt||'')||0}
    function heatOf(b){return stats[b.projectId||b.id]||{read:0,reading:0,wishlist:0,hot7:0}}
    var scored=rows.filter(function(b){return scoreOf(b)>0});
    function byScore(a){return a.slice().sort(function(x,y){return scoreOf(y)-scoreOf(x)})}
    var now=Date.now();
    function within(days){return function(b){return now-dateOf(b)<days*86400000}}
    // 贝叶斯口碑：阅读人数少的高分书向全站均分收缩，读得多才立得住
    var avg=scored.length?scored.reduce(function(a,b){return a+scoreOf(b)},0)/scored.length:80;
    function bayes(b){var h=heatOf(b);var v=h.read+h.reading;return (v*scoreOf(b)+8*avg)/(v+8)}
    function byBayes(a){return a.slice().sort(function(x,y){return bayes(y)-bayes(x)})}
    var heatTotal=rows.reduce(function(a,b){var h=heatOf(b);return a+h.hot7+h.reading},0);
    if(heatTotal<5){BOARDS[0].t=T('近期佳作','Recent highlights');BOARDS[0].n=T('阅读数据尚少，暂按近 30 天新书的编辑评分排序','Limited reading data; ordered by editorial scores for releases in the last 30 days')}
    function surgeScore(b){var h=heatOf(b);return h.hot7*4+h.reading*2+h.read+(within(30)(b)?6:0)+Math.max(0,scoreOf(b)-70)*0.3}
    var cats={};rows.forEach(function(b){var g=b.category||T('历史','History');cats[g]=(cats[g]||0)+1});
    var catNames=Object.keys(cats).sort(function(a,b){return cats[b]-cats[a]});
    function listFor(key){
      if(key==='surging'){
        if(heatTotal<5)return byScore(scored.filter(within(30))).slice(0,20);
        return rows.filter(function(b){var h=heatOf(b);return h.hot7+h.reading+h.read>0||within(30)(b)})
          .sort(function(x,y){return surgeScore(y)-surgeScore(x)}).slice(0,20);
      }
      if(key==='fresh')return rows.slice().sort(function(a,b){return dateOf(b)-dateOf(a)}).slice(0,20);
      if(key==='top')return byBayes(scored).slice(0,20);
      if(key==='master')return byBayes(scored.filter(function(b){return scoreOf(b)>=85})).slice(0,20);
      if(key.indexOf('cat-')===0){var g=decodeURIComponent(key.slice(4));return byBayes(rows.filter(function(b){return (b.category||T('历史','History'))===g})).slice(0,20)}
      return [];
    }
    function headFor(key){
      var bd=BOARDS.filter(function(b){return b.k===key})[0];
      if(bd)return bd;
      if(key.indexOf('cat-')===0){var g=decodeURIComponent(key.slice(4));return {t:g,n:cats[g]?cats[g]+T(' 部作品 · 按口碑加权排序',' books · weighted by readership'):'',bg:CAT_BG,orn:g.slice(0,1)}}
      return BOARDS[0];
    }
    var nav=document.querySelector('[data-nav]');
    var navHtml='<div class="nav-sec">'+T('榜单','CHARTS')+'</div>';
    BOARDS.forEach(function(b){navHtml+='<button type="button" data-key="'+b.k+'">'+esc(b.t)+'</button>'});
    navHtml+='<div class="nav-sec">'+T('分类','CATEGORIES')+'</div>';
    catNames.forEach(function(g){navHtml+='<button type="button" data-key="cat-'+encodeURIComponent(g)+'">'+esc(g)+'<em>'+cats[g]+'</em></button>'});
    nav.innerHTML=navHtml;
    // 今日主编推荐：85+ 池按日期种子轮换，全站同一本
    (function(){
      var pool=byScore(scored.filter(function(b){return scoreOf(b)>=85}));
      if(!pool.length)return;
      var d=new Date();var seed=d.getFullYear()*372+(d.getMonth()+1)*31+d.getDate();
      var pick=pool[seed%pool.length];
      var el=document.querySelector('[data-pick]');
      el.href=pick.url||'#';
      el.innerHTML='<span class="dp-tag">'+T('今日主编推荐','Editor’s pick')+'</span>'
        +(pick.coverUrl?'<span class="dp-cover"><img src="'+esc(pick.coverUrl)+'" alt=""></span>':'')
        +'<span class="dp-name">'+esc(pick.title)+'</span><span class="dp-go">'+T('去看看 →','Read →')+'</span>';
      el.hidden=false;
    })();
    function heatLine(b){
      var h=heatOf(b);var bits=[];
      if(h.read)bits.push(h.read+T(' 人读过',' read'));
      if(h.reading)bits.push(h.reading+T(' 人在读',' reading'));
      if(h.hot7)bits.push(T('7天热度 ','7d heat ')+h.hot7);
      return bits.join(' · ');
    }
    function render(key){
      var head=headFor(key);
      document.querySelector('[data-hero]').style.setProperty('--rh-bg',head.bg||CAT_BG);
      document.querySelector('[data-orn]').textContent=head.orn||'';
      document.querySelector('[data-title]').textContent=head.t;
      document.querySelector('[data-note]').textContent=head.n||'';
      nav.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x.dataset.key===key)});
      var list=listFor(key);
      var box=document.querySelector('[data-list]');
      var pod=document.querySelector('[data-podium]');
      if(!list.length){pod.hidden=true;box.innerHTML='<div class="empty">'+T('这个榜单暂时是空的。','Nothing here yet.')+'</div>';return}
      var top3=list.slice(0,3),rest=list.slice(3);
      pod.hidden=false;
      pod.innerHTML=top3.map(function(b,i){
        var s=scoreOf(b);var hl=heatLine(b);
        return '<a class="pd-card'+(i===0?' p1':'')+'" href="'+esc(b.url||'#')+'">'
          +'<i class="pd-medal m'+(i+1)+'">'+(i+1)+'</i>'
          +'<span class="pd-cov">'+(b.coverUrl?'<img src="'+esc(b.coverUrl)+'" alt="'+esc(b.title)+'" loading="lazy">':'')+'</span>'
          +'<strong>'+esc(b.title)+'</strong>'
          +'<small>'+esc(b.authorDisplayName||T('未署名','Unsigned'))+'</small>'
          +'<span class="pd-rec">'+(s?'<span class="reco-line">'+T('编辑评分 ','Editorial score ')+'<b>'+(s/10).toFixed(1)+'</b></span>':'')+(hl?'<span class="readers-badge">'+hl+'</span>':'')+'</span>'
          +'</a>';
      }).join('');
      box.innerHTML=rest.map(function(b,i){
        var s=scoreOf(b);var hl=heatLine(b);
        return '<a class="rk-item" href="'+esc(b.url||'#')+'">'
          +'<i class="rk-num">'+(i+4)+'</i>'
          +'<span class="rk-cov">'+(b.coverUrl?'<img src="'+esc(b.coverUrl)+'" alt="'+esc(b.title)+'" loading="lazy">':'')+'</span>'
          +'<span class="rk-info"><strong>'+esc(b.title)+'</strong>'
          +'<small>'+esc(b.authorDisplayName||T('未署名','Unsigned'))+' · '+esc(b.category||T('历史','History'))+' · '+(Number(b.chapterCount)||0)+T(' 章',' chapters')+'</small>'
          +(b.description?'<p class="rk-desc">'+esc(String(b.description).replace(/\s+/g,' ').slice(0,150))+'</p>':'')
          +((s||hl)?'<span class="rk-rec">'+(s?'<span class="reco-line">'+T('编辑评分 ','Editorial score ')+'<b>'+(s/10).toFixed(1)+'</b></span>':'')+(hl?'<span class="readers-badge">'+hl+'</span>':'')+'</span>':'')
          +'</span></a>';
      }).join('');
    }
    nav.addEventListener('click',function(e){
      var b=e.target.closest&&e.target.closest('button[data-key]');
      if(!b)return;
      location.hash=b.dataset.key;
    });
    function fromHash(){var k=(location.hash||'').replace(/^#/,'')||'surging';render(k)}
    addEventListener('hashchange',fromHash);
    fromHash();
  }
})();
