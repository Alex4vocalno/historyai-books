(function(){
  var sec=document.querySelector('[data-quotes]');if(!sec)return;
  var rail=sec.querySelector('[data-quote-rail]');
  var EN=location.pathname.indexOf('index-en')>=0;
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  fetch('/api/reader/feed').then(function(r){return r.json()}).then(function(d){
    if(!(d&&d.ok&&d.rows))return;
    var seen={},out=[];
    d.rows.forEach(function(r){
      if(r.type!=='note'||!r.quote||!r.bookTitle)return;
      var k=r.bookId+'|'+r.quote;
      if(out.length<6&&!seen[k]){seen[k]=1;out.push(r)}
    });
    if(!out.length)return;
    rail.innerHTML=out.map(function(r){
      var src=EN?(' underlined in \u201c'+esc(r.bookTitle)+'\u201d'):('\u5212\u7ebf\u4e8e\u300a'+esc(r.bookTitle)+'\u300b');
      return '<a class="quote-card" href="books/'+encodeURIComponent(r.bookId)+'/index.html">'
        +'<p class="q-mark">\u201c</p><p class="q-text">'+esc(r.quote)+'</p>'
        +(r.text?'<p class="q-idea">'+esc(r.text)+'</p>':'')
        +'<p class="q-src"><b>'+esc(r.name||(EN?'Reader':'\u8bfb\u8005'))+'</b> '+src+'</p></a>';
    }).join('');
    sec.hidden=false;
  }).catch(function(){});
})();
