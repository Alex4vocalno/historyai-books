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
  var filtered=Boolean(state.category||state.kind||state.language);
  grid.innerHTML=visible.length?visible.map(bookCard).join(''):'<div class="search-empty"><h4>'+(EN?'No books found yet':'暂时没有找到这本书')+'</h4><p>'+(EN?'Try a shorter title, an author or a broader subject.':'试试更简短的书名、作者，或一个更宽泛的主题。')+'</p><div class="search-empty-actions"><button type="button" data-search-edit>'+(EN?'Edit search':'修改搜索')+'</button>'+(filtered?'<button type="button" data-search-relax>'+(EN?'Remove filters':'取消筛选条件')+'</button>':'')+'</div></div>';
  var order=document.querySelector('[data-sort="default"]');if(order)order.textContent=state.q.trim()?(EN?'Best match':'相关度'):(EN?'Newest':'最新上架');
  var idea=document.querySelector('[data-reading-intent]');
  if(!idea){idea=document.createElement('div');idea.className='reading-intent';idea.setAttribute('data-reading-intent','');grid.after(idea)}
  idea.hidden=!state.q.trim();
  if(!idea.hidden){
    var entry=document.querySelector('.cta-write[data-write-entry]');
    var target=entry&&new URL(entry.href,location.href);
    if(target&&/^https?:$/.test(target.protocol)){
      target.hash=new URLSearchParams({'reading-topic':state.q,'book-language':state.language,'book-kind':state.kind}).toString();
      idea.innerHTML='<div><h4>'+(EN?'The book you want might start with you.':'想读的书，也可以由你开始。')+'</h4><p>'+(EN?'Bring this subject into a book of your own.':'从这个主题出发，构思一本自己的书。')+'</p></div><a rel="noreferrer" href="'+esc(target.href)+'">'+(EN?'Explore this idea':'构思这本书')+' <span aria-hidden="true">↗</span></a>';
    }else idea.hidden=true;
  }
  var meta=document.querySelector('[data-result-meta]');if(meta)meta.textContent=EN?'Showing '+visible.length+' of '+total+' books':'共 '+total+' 部作品 · 已显示 '+visible.length+' 部';
  if(moreBox){moreBox.hidden=visible.length>=total;var remain=moreBox.querySelector('[data-shelf-remaining]');if(remain)remain.textContent=Math.max(0,total-visible.length)}
  var searching=Boolean(state.q||state.category||state.kind||state.language);
  document.body.classList.toggle('searching',searching);
  var head=document.querySelector('[data-results-title]');if(head)head.textContent=searching?(EN?'Search results':'搜索结果'):(EN?'All books':'全部作品');
  var clear=document.querySelector('[data-search-clear]');if(clear)clear.hidden=!searching;
  try{document.dispatchEvent(new CustomEvent('bookshelf:cards',{detail:{ids:visible.map(function(b){return b.p})}}))}catch(e){}
});
if(grid)grid.addEventListener('click',function(e){var author=e.target.closest('[data-author-link]');if(author){e.preventDefault();e.stopPropagation();location.href=author.dataset.authorLink;return}var read=e.target.closest('[data-read-link]');if(read){e.preventDefault();e.stopPropagation();var target=read.dataset.readLink;var card=e.target.closest('[data-book-card]');var book=BOOKS[card&&card.dataset.pid];
  if(book&&readerId!==null){var recent=EvoronDiscovery.recentBooks([book],localProgress(),cloudRows,readerId);if(recent.length)target=recent[0].href}
  location.href=target}});
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
function recCard(item){
  var b=item.book, en=document.documentElement.lang.indexOf('en')===0;
  var art=recArt(b);
  var reason=item.related?(en?'Related to your library':'与你收藏或阅读的题材相关'):(en?'Explore the library':'发现不同的书');
  return '<a class="rec-card" href="'+esc(b.u)+'">'+art+'<span class="rec-body"><em class="rec-cat">'+esc(en?b.categoryEn||b.g:b.g)+'</em><strong>'+esc(b.t)+'</strong><small>'+esc(b.a)+'</small><small data-rec-reason>'+reason+'</small></span></a>';
}
function continueCard(r){
  var pct=r.b.n?Math.min(100,Math.round((r.ch+1)/r.b.n*100)):0;
  return '<a class="rec-card cont-card" title="'+esc(r.b.t)+'" href="'+esc(r.href||r.b.r)+'">'+recArt(r.b)+'<span class="rec-body"><em class="rec-cat" data-continue-label>继续阅读</em><strong>'+esc(r.b.t)+'</strong><small data-continue-progress>读到第 '+(r.ch+1)+' 章 · '+pct+'%</small><span class="cont-bar"><i style="width:'+pct+'%"></i></span></span></a>';
}
var readerId=null,cloudRows=[],recOffset=0,identityRequest=0;
function drawRail(){
  if(!railBox)return;
  var picks=EvoronDiscovery.recommendations(POOL,localProgress(),cloudRows,readerId,recOffset);
  railBox.innerHTML=picks.map(recCard).join('');
  var note=document.querySelector('[data-rec-note]'),en=document.documentElement.lang.indexOf('en')===0;
  if(note)note.textContent=picks.length?(en?'Explore authors, subjects and languages':'发现不同作者、题材与语言的作品'):(en?'You have explored this selection':'这些作品已在你的阅读记录中');
  if(reroll)reroll.hidden=picks.length===0;
}
var reroll=document.querySelector('[data-reroll]');if(reroll)reroll.addEventListener('click',function(){recOffset+=4;drawRail()});
drawRail();
function localProgress(){
  var rows=[];
  try{for(var i=0;i<localStorage.length;i++){
    var key=localStorage.key(i);if(!key||key.indexOf('historyai.reader.')!==0)continue;
    try{var row=JSON.parse(localStorage.getItem(key)||'null');if(row&&typeof row==='object')rows.push(Object.assign({},row,{bookId:key.slice('historyai.reader.'.length)}))}catch(e){}
  }}catch(e){}
  return rows;
}
function drawContinue(cloud,userId){
  var box=document.querySelector('.continue-box');if(!box)return;
  if(readerId===null){box.hidden=true;box.querySelector('.continue-strip').innerHTML='';return}
  var recent=EvoronDiscovery.recentBooks(POOL,localProgress(),cloud||[],userId||'');
  box.hidden=!recent.length;box.querySelector('.continue-strip').innerHTML=recent.map(continueCard).join('');
}
function refreshReader(){
  var ticket=++identityRequest;
  readerId=null;cloudRows=[];recOffset=0;drawContinue();drawRail();
  fetch('/api/reader/shelf',{credentials:'same-origin',cache:'no-store'}).then(function(r){
    if(r.status===401)return {guest:true};
    if(!r.ok)throw Error('Reader unavailable');
    return r.json();
  }).then(function(d){
    if(ticket!==identityRequest)return;
    if(d.guest)readerId='';
    else if(d.ok&&typeof d.syncUserId==='string'&&d.syncUserId&&Array.isArray(d.rows)){readerId=d.syncUserId;cloudRows=d.rows}
    drawContinue(cloudRows,readerId);drawRail();
  }).catch(function(){});
}
refreshReader();
window.addEventListener('focus',refreshReader);
window.addEventListener('pageshow',function(e){if(e.persisted)refreshReader()});
window.addEventListener('storage',function(e){if(!e.key||e.key.indexOf('historyai.reader.')===0)refreshReader()});
window.addEventListener('evoron:language',function(){window.queueMicrotask(drawRail)});
// Legacy home shelf links open the same shelf page as every other entry.
if(location.hash.indexOf('#myshelf')===0){
  var status=(location.hash.match(/^#myshelf-(reading|wishlist|finished)$/)||[])[1]||'';
  location.replace('shelf.html?lang='+(document.documentElement.lang.indexOf('en')===0?'en':'zh')+(status?'&status='+status:''));
}

})();
