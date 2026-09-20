EvoronShelf.installPage(window);
(function(){
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
var EN=EvoronShelf.language(window)==='en';function T(zh,en){return EN?en:zh;}
    fetch('/api/reader/profile',{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(p){
      if(p&&p.ok){var en=EvoronShelf.language(window)==='en';document.getElementById('me').textContent=p.profile.name+(en?' · Finished ':' · 读完 ')+p.profile.shelf.finished+(en?' · Notes ':' 本 · 想法 ')+p.profile.notes+(en?' · Reviews ':' 条 · 书评 ')+p.profile.reviews+(en?'':' 条');}
    }).catch(function(){});
    // v5.8 通知箱：被回复/被赞；打开书架即视为已读（小红点熄灭）
    fetch('/api/reader/notifications',{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(n){
      if(!(n&&n.ok&&n.rows&&n.rows.length))return;
      var box=document.getElementById('noti');
      box.appendChild(el('div','sect',T('通知','Notifications')));
      n.rows.slice(0,20).forEach(function(row){
        var c=el('div','nrow'+(row.read?'':' unread'));
        var t=el('span','nt');
        if(row.type==='ops'){
          // v5.53.6 运维告警（owner 专收）：直接显示告警文本
          t.innerHTML='<b></b> ⚙ '+(row.text?row.text.replace(/</g,'&lt;').slice(0,110):'');
          t.querySelector('b').textContent=row.fromName||T('系统','System');
          c.appendChild(t);
          box.appendChild(c);
          return;
        }
        var verb=row.type==='like'?T('赞了你的',' liked your '):T('回复了你的',' replied to your ');
        var what=row.kind==='review'?T('书评','review'):(row.kind==='reply'?T('回复','reply'):T('想法','thought'));
        t.innerHTML='<b></b> '+verb+what+(row.text?'：'+row.text.replace(/</g,'&lt;').slice(0,60):'');
        t.querySelector('b').textContent=row.fromName||T('读者','Reader');
        c.appendChild(t);
        var a=el('a','', row.bookTitle||T('去看看','View'));
        a.href='/books/'+encodeURIComponent(row.bookId)+'/';
        c.appendChild(a);
        box.appendChild(c);
      });
      if(n.unread>0)fetch('/api/reader/notifications',{method:'POST',credentials:'same-origin'}).catch(function(){});
    }).catch(function(){});
})();
