// 书城首页的发现区（筛选、排序、换一批、查看更多）。issue #5 之前是一段 9 KB 的
// 内联脚本；现在逻辑在这里，书目数据从页面上的
// <script type="application/json" id="evoron-store-pool"> 读进来。
(function(){
var POOL=JSON.parse(document.getElementById('evoron-store-pool').textContent);
var BOOKS={};POOL.forEach(function(b){BOOKS[b.p]=b});
var grid=document.querySelector('.shelf');var moreBox=document.querySelector('[data-shelf-more]');
function coverHtml(b){
  var attrs=' loading="lazy" decoding="async"';
  if(b.c&&b.x)return '<div class="cover-art cover-thumb cover-typeset"><img src="'+esc(b.c)+'" alt="'+esc(b.t)+'"'+attrs+'>'+coverTypeHtml(b)+'</div>';
  if(b.c)return '<div class="cover-art cover-thumb"><img src="'+esc(b.c)+'" alt="'+esc(b.t)+'"'+attrs+'></div>';
  return '<div class="cover-art"><div class="cover-copy"><h2>'+esc(b.t)+'</h2><small>'+esc(b.a||'')+'</small></div></div>';
}
function recoLine(b){
  var s=Number(b.s)||0;
  if(!s)return '<span class="muted">'+esc(b.g||'')+'</span>';
  return '<span class="reco-line" title="编辑评分，满分 10 分">编辑评分 <b>'+(s/10).toFixed(1)+'</b></span>';
}
function bookCard(b){
  var chip=b.s?'<span class="score-chip">'+(b.s/10).toFixed(1)+'</span>':'';
  return '<a class="book-card" data-book-card data-pid="'+esc(b.p)+'" title="'+esc(b.t)+'" data-category="'+esc(b.g)+'" data-search="'+esc(b.h)+'" data-score="'+b.s+'" data-chapters="'+b.n+'" data-index="'+b.i+'" href="'+esc(b.u)+'"><div class="cover-slot">'+coverHtml(b)+chip+'<span class="cover-hover">'+(b.d?'<span class="hover-desc">'+esc(b.d)+'</span>':'')+'<span class="start-btn" data-read-link="'+esc(b.r)+'">开始阅读</span></span></div><h2>'+esc(b.t)+'</h2><p><span class="card-author" data-author-link="'+esc(b.au)+'">'+esc(b.a)+'</span></p><div class="card-meta">'+recoLine(b)+(b.l?'<span class="len-pill">'+esc(b.l)+'</span>':'')+'<span class="readers-badge" data-readers hidden></span></div></a>';
}
window.EvoronDiscovery.install(window,POOL,function(visible,total,state){
  var EN=document.documentElement.lang.indexOf('en')===0;
  grid.innerHTML=visible.length?visible.map(bookCard).join(''):'<p class="empty">'+(EN?'No matching books. Try fewer keywords or clear the filters.':'没有匹配的作品，可以减少关键词或清除筛选。')+'</p>';
  var meta=document.querySelector('[data-result-meta]');if(meta)meta.textContent=EN?'Showing '+visible.length+' of '+total+' books':'共 '+total+' 部作品 · 已显示 '+visible.length+' 部';
  if(moreBox){moreBox.hidden=visible.length>=total;var remain=moreBox.querySelector('[data-shelf-remaining]');if(remain)remain.textContent=Math.max(0,total-visible.length)}
  var searching=Boolean(state.q||state.category||state.kind||state.language);
  document.body.classList.toggle('searching',searching);
  var head=document.querySelector('[data-results-title]');if(head)head.textContent=searching?(EN?'Search results':'搜索结果'):(EN?'All books':'全部作品');
  var clear=document.querySelector('[data-search-clear]');if(clear)clear.hidden=!searching;
  try{document.dispatchEvent(new CustomEvent('bookshelf:cards',{detail:{ids:visible.map(function(b){return b.p})}}))}catch(e){}
});
if(grid)grid.addEventListener('click',function(e){var author=e.target.closest('[data-author-link]');if(author){e.preventDefault();e.stopPropagation();location.href=author.dataset.authorLink;return}var read=e.target.closest('[data-read-link]');if(read){e.preventDefault();e.stopPropagation();var target=read.dataset.readLink;var card=e.target.closest('[data-book-card]');try{var st=JSON.parse(localStorage.getItem('historyai.reader.'+(card&&card.dataset.pid))||'{}');if(st&&st.href&&(!st.releaseId||st.releaseId===(BOOKS[card&&card.dataset.pid]||{}).release)&&/^ch-\d+\.html$/.test(st.href))target=target.replace(/(?:read|ch-1)\.html$/,st.href)}catch(e2){}location.href=target}});
var railBox=document.querySelector('[data-rail]');
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function coverThemeName(b){
  var text=[b&&b.t,b&&b.sub,b&&b.g,b&&b.a].filter(Boolean).join(' ').toLowerCase();
  if(/[禅佛悟寺僧心]/.test(text))return 'zen';
  if(/补天|天裂|神话|玄幻|仙侠|ghost|spirit|myth|fantasy/.test(text))return 'mythic';
  if(/李建成|玄武|唐|长安|太子|宫廷|权谋|隋|tang|palace|prince/.test(text))return 'tang';
  if(/科技|芯片|互联网|浏览器|游戏|商业|公司|tech|chip|browser|business|game/.test(text))return 'tech';
  return 'literary';
}
function coverTitleClass(title){
  var t=String(title||''),u=0;for(var i=0;i<t.length;i++)u+=(t.charCodeAt(i)<128?0.55:1);
  if(u>=12)return ' cover-title-very-long';
  if(u>=8)return ' cover-title-long';
  return '';
}
function coverTypeHtml(b){
  return '<div class="cover-type cover-theme-'+coverThemeName(b)+coverTitleClass(b&&b.t)+'"><h2><span>'+esc(b&&b.t)+'</span></h2><i></i><small>'+esc((b&&b.a)||'')+'</small></div>';
}
// v5.14 rec card, horizontal per design mock: cover left, category chip, serif title, author
function recArt(b){
  var art=(b.c&&b.x)
    ?'<div class="rec-cover cover-typeset"><img src="'+esc(b.c)+'" alt="'+esc(b.t)+'" loading="lazy" decoding="async">'+coverTypeHtml(b)+'</div>'
    :(b.c
      ?'<div class="rec-cover cover-thumb"><img src="'+esc(b.c)+'" alt="'+esc(b.t)+'" loading="lazy" decoding="async"></div>'
      :'<div class="rec-cover"><div class="cover-copy"><h2>'+esc(b.t)+'</h2></div></div>');
  return art;
}
function recCard(b){
  var art=recArt(b);
  return '<a class="rec-card" href="'+esc(b.u)+'">'+art+'<span class="rec-body"><em class="rec-cat">'+esc(b.g)+'</em><strong>'+esc(b.t)+'</strong><small>'+esc(b.a)+'</small></span></a>';
}
function continueCard(r){
  var pct=r.b.n?Math.min(100,Math.round((r.ch+1)/r.b.n*100)):0;
  return '<a class="rec-card cont-card" title="'+esc(r.b.t)+'" href="'+esc(r.href||r.b.r)+'">'+recArt(r.b)+'<span class="rec-body"><em class="rec-cat" data-continue-label>继续阅读</em><strong>'+esc(r.b.t)+'</strong><small data-continue-progress>读到第 '+(r.ch+1)+' 章 · '+pct+'%</small><span class="cont-bar"><i style="width:'+pct+'%"></i></span></span></a>';
}
// v5.12 For-you picks: signals = local reading traces + signed-in shelf;
// category affinity x3 + editorial score + jitter; read/shelved books excluded.
var KNOWN={},FAVCAT={},recPool=[];
function collectLocalSignals(){
  try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k||k.indexOf('historyai.reader.')!==0)continue;var pid=k.slice('historyai.reader.'.length);KNOWN[pid]=1;
    for(var j=0;j<POOL.length;j++)if(POOL[j].p===pid){FAVCAT[POOL[j].g]=(FAVCAT[POOL[j].g]||0)+1;break}}}catch(e){}
}
function buildRecs(){
  recPool=POOL.filter(function(b){return !KNOWN[b.p]}).map(function(b){
    return {b:b,w:(FAVCAT[b.g]||0)*3+(b.s||0)/25+Math.max(0,1-(Date.now()-b.at)/(30*86400000))};
  }).sort(function(a,c){return c.w-a.w}).slice(0,12).map(function(x){return x.b});
  var note=document.querySelector('[data-rec-note]');
  if(note&&Object.keys(FAVCAT).length)note.textContent='按你的阅读口味挑选';
}
function drawRail(){
  if(!railBox)return;
  var pool=recPool.length?recPool.slice():POOL.slice();
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t}
  railBox.innerHTML=pool.slice(0,4).map(recCard).join('');
}
var reroll=document.querySelector('[data-reroll]');if(reroll)reroll.addEventListener('click',drawRail);
collectLocalSignals();
buildRecs();drawRail();
fetch('/api/reader/shelf',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){
  if(d&&d.ok){var cloud=(d.rows||[]).filter(function(row){return row.status==='reading'&&BOOKS[row.bookId]&&row.releaseId===BOOKS[row.bookId].release}).slice(0,4);if(cloud.length){var box=document.querySelector('.continue-box');box.hidden=false;box.querySelector('.continue-strip').innerHTML=cloud.map(function(row){var b=BOOKS[row.bookId];return continueCard({b:b,ch:row.chapter,href:EvoronDiscovery.continueHref(b,row)})}).join('')}}
  if(d&&d.ok)(d.rows||[]).forEach(function(row){KNOWN[row.bookId]=1;
    for(var j=0;j<POOL.length;j++)if(POOL[j].p===row.bookId){FAVCAT[POOL[j].g]=(FAVCAT[POOL[j].g]||0)+2;break}});
}).catch(function(){}).then(function(){buildRecs();drawRail()});
// Legacy home shelf links open the same shelf page as every other entry.
if(location.hash.indexOf('#myshelf')===0){
  var status=(location.hash.match(/^#myshelf-(reading|wishlist|finished)$/)||[])[1]||'';
  location.replace('shelf.html?lang='+(document.documentElement.lang.indexOf('en')===0?'en':'zh')+(status?'&status='+status:''));
}

try{
  var recent=[];
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k||k.indexOf('historyai.reader.')!==0)continue;var pid=k.slice('historyai.reader.'.length);var b=BOOKS[pid];if(!b)continue;var st={};try{st=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}var ch=Number(st.chapter);if(!isFinite(ch))continue;recent.push({pid:pid,b:b,ch:ch,at:Date.parse(st.updatedAt||0)||0,href:EvoronDiscovery.continueHref(b,st)})}
  recent.sort(function(a,b){return b.at-a.at});recent=recent.slice(0,6);
  if(recent.length){var box=document.querySelector('.continue-box');box.hidden=false;var strip=box.querySelector('.continue-strip');
    strip.innerHTML=recent.slice(0,4).map(continueCard).join('')}
}catch(e){}
})();
