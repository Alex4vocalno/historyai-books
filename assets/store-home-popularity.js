(function(){
  var all={},requested={};
  function fill(cards){
    cards.forEach(function(c){
      var s=all[c.dataset.pid];
      if(!s)return;
      var el=c.querySelector('[data-readers]');
      if(!el)return;
      if(s.read>0){el.innerHTML='<b>'+s.read+'</b> 人读过';el.hidden=false}
      else if(s.reading>0){el.innerHTML='<b>'+s.reading+'</b> 人在读';el.hidden=false}
      if(s.hot7>0)c.dataset.hot7=s.hot7;
    });
  }
  function hydrate(ids){
    var cards=[].slice.call(document.querySelectorAll('[data-book-card][data-pid]'));
    var wanted=(ids||cards.map(function(c){return c.dataset.pid})).filter(function(id){return id&&!requested[id]});
    wanted.forEach(function(id){requested[id]=1});
    if(!wanted.length){fill(cards);return}
    var chunks=[];for(var i=0;i<wanted.length;i+=80)chunks.push(wanted.slice(i,i+80));
    Promise.all(chunks.map(function(chunk){
    return fetch('/api/social/book-stats?ids='+encodeURIComponent(chunk.join(','))).then(function(r){return r.json()}).then(function(d){
      if(d&&d.ok&&d.stats)Object.assign(all,d.stats);
    }).catch(function(){});
    })).then(function(){fill(cards)});
  }
  hydrate();
  document.addEventListener('bookshelf:cards',function(e){hydrate(e.detail&&e.detail.ids)});
})();
