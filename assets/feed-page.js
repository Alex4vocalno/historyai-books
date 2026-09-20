(function(){
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
  function bookLink(r){var a=el('a','bk','《'+(r.bookTitle||r.bookId)+'》');a.href='/books/'+encodeURIComponent(r.bookId)+'/';return a;}
  fetch('/api/reader/feed').then(function(r){return r.json();}).then(function(d){
    // v5.59.1 新上架条（总账倒序前 8，带封面）
    var latest=(d&&d.latest)||[];
    if(latest.length){
      var ls=document.getElementById('latest');ls.hidden=false;document.getElementById('latestSect').hidden=false;
      latest.forEach(function(b){
        var a=el('a');a.href='/books/'+encodeURIComponent(b.bookId)+'/';
        var cv=el('div','lc');
        if(b.cover){var im=document.createElement('img');im.loading='lazy';im.src=b.cover;im.alt=b.title||'';cv.appendChild(im);}
        a.appendChild(cv);a.appendChild(el('div','lt',b.title||''));
        ls.appendChild(a);
      });
    }
    var box=document.getElementById('feed');box.innerHTML='';
    var rows=(d&&d.rows)||[];
    if(!rows.length){box.appendChild(el('div','empty','还没有动态。去读一本书，划下第一条想法。'));return;}
    rows.forEach(function(r){
      var c=el('div','frow');
      // v5.59.1 封面缩略：动态行带书封，点击进书页
      if(r.cover){var cva=el('a','cv');cva.href='/books/'+encodeURIComponent(r.bookId)+'/';var cvi=document.createElement('img');cvi.loading='lazy';cvi.src=r.cover;cvi.alt=r.bookTitle||'';cva.appendChild(cvi);c.appendChild(cva);}
      var bd=el('div','bd');
      var who=el('div','who');
      var b=el('b','',r.name||'读者');who.appendChild(b);
      var verb=r.type==='review'?' 点评了 ':(r.type==='finished'?' 读完了 ':' 在 ');
      who.appendChild(document.createTextNode(verb));
      who.appendChild(bookLink(r));
      if(r.type==='note')who.appendChild(document.createTextNode(' 留下想法'));
      if(r.type==='review'&&r.rating){var st=el('span','stars',' '+'★'.repeat(r.rating));who.appendChild(st);}
      who.appendChild(document.createTextNode(' · '+String(r.at||'').slice(0,10)));
      bd.appendChild(who);
      if(r.quote)bd.appendChild(el('div','quote',r.quote));
      if(r.text)bd.appendChild(el('div','txt',r.text));
      c.appendChild(bd);
      box.appendChild(c);
    });
  }).catch(function(){document.getElementById('feed').innerHTML='<div class="empty">动态暂时打不开。</div>';});
  fetch('/api/reader/leaderboard').then(function(r){return r.json();}).then(function(d){
    var box=document.getElementById('boardBox');box.innerHTML='';
    var rows=(d&&d.rows)||[];
    if(!rows.length){box.appendChild(el('div','empty','本周还没有登录阅读记录，读起来就能上榜。'));return;}
    rows.forEach(function(r,i){
      var c=el('div','brow');
      c.appendChild(el('span','rank'+(i<3?' hot':''),String(i+1)));
      c.appendChild(el('span','nm',r.name));
      var s=el('small','',(r.finishes?('完读 '+r.finishes+' 章 · '):'')+'读 '+r.chapters+' 章次');
      c.appendChild(s);
      box.appendChild(c);
    });
  }).catch(function(){});
})();
