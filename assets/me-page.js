(function(){
  var EN=window.EvoronLanguage.state().language==='en';
  var T=function(zh,en){return EN?en:zh};
  document.title=T('我的主页 · EVORON AI','My Page · EVORON AI');
  var tmap={title:['我的主页','My page'],back:['← 返回书库','← Library'],shelf:['我的书架','My shelf'],feed:['社区动态','Community'],loading:['正在打开…','Loading…']};
  Object.keys(tmap).forEach(function(k){var el=document.querySelector('[data-t="'+k+'"]');if(el&&EN)el.textContent=tmap[k][1]});
  var main=document.getElementById('main');
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
  function j(u,opt){return fetch(u,Object.assign({credentials:'same-origin'},opt||{})).then(function(r){return r.json()})}
  j('/api/auth/me').then(function(me){
    if(!(me&&me.ok&&me.user)){
      main.innerHTML='';
      var em=el('div','empty');
      em.appendChild(document.createTextNode(T('登录后即可看到你的书架、想法与通知。','Sign in to see your shelf, thoughts and notifications.')));
      em.appendChild(document.createElement('br'));
      var a=el('a','',T('登录 / 注册','Sign in / Register'));a.href='/index.html?login=1&returnTo=%2Fme.html';
      em.appendChild(a);
      main.appendChild(em);
      return;
    }
    var u=me.user;
    main.innerHTML='';
    var card=el('div','idcard');
    var av=el('div','avatar',(u.penName||'EVORON').slice(0,1).toUpperCase());
    card.appendChild(av);
    var mid=el('div','');
    mid.appendChild(el('div','nm',u.penName||T('尚未设置笔名','Pen name not set')));
    mid.appendChild(el('div','role',u.role==='owner'?T('超级用户','Owner'):T('读者 · 作者','Reader · Writer')));
    card.appendChild(mid);
    var go=el('div','go');
    var st=el('a','');st.innerHTML='<img class="ico" src="assets/icons/write-inv.png" alt=""> '+T('进入写作台','Open the studio');st.href='https://write.evoronai.com/';go.appendChild(st);
    var settings=el('a','',T('账号管理','Account settings'));settings.href='/account.html?tab=profile';go.appendChild(settings);
    card.appendChild(go);
    main.appendChild(card);
    var account=el('section','account-overview');
    var accountInfo=el('div','');
    accountInfo.appendChild(el('p','',T('剩余积分','Remaining credits')));
    var amount=el('strong','',T('正在读取…','Loading…'));accountInfo.appendChild(amount);
    accountInfo.appendChild(el('p','',T('阅读免费。写作、编修使用积分。','Reading is free. Credits are for writing and editing.')));
    accountInfo.appendChild(el('p','',u.email?(u.email+' · '+(u.emailVerified?T('已验证','Verified'):T('待验证','Unverified'))):T('邮箱待绑定，原有作品与积分保留','Link your email. Existing books and credits are preserved.')));
    var accountNav=el('nav','');
    [['/account.html?tab=credits',T('积分与购买记录','Credits & orders')],['/pricing.html',T('积分方案','Credit packs')],['/account.html?tab=profile',T('邮箱与笔名','Email & pen name')],['/account.html?tab=security',T('账号安全','Security')]].forEach(function(item){var link=el('a','',item[1]);link.href=EN&&item[0]==='/pricing.html'?'/pricing-en.html':item[0];accountNav.appendChild(link)});
    account.appendChild(accountInfo);account.appendChild(accountNav);main.appendChild(account);
    j('/api/billing/mine',{cache:'no-store'}).then(function(data){var b=data&&data.ok&&data.balance;amount.textContent=b&&b.unlimited?T('不限额度','Unlimited'):b&&Number.isFinite(b.remaining)?b.remaining.toLocaleString(EN?'en-US':'zh-CN'):T('暂不可用','Unavailable')}).catch(function(){amount.textContent=T('暂不可用','Unavailable')});
    var stats=el('div','stats');main.appendChild(stats);
    function stat(icon,n,label,href){var s2=el('div','stat');var inner=href?el('a',''):s2;var im=document.createElement('img');im.className='si';im.src='assets/icons/'+icon+'.png';im.alt='';var b=el('b','',String(n));var sp=el('span','',label);if(href){inner.href=href;inner.appendChild(im);inner.appendChild(b);inner.appendChild(sp);s2.appendChild(inner)}else{s2.appendChild(im);s2.appendChild(b);s2.appendChild(sp)}stats.appendChild(s2)}
    Promise.all([j('/api/reader/shelf').catch(function(){return null}),j('/api/reader/profile').catch(function(){return null}),j('/api/reader/notifications').catch(function(){return null})]).then(function(rs){
      var shelf=rs[0]&&rs[0].ok?rs[0]:{counts:{wishlist:0,reading:0,finished:0}};
      var prof=(rs[1]&&rs[1].ok&&rs[1].profile)||{};
      var noti=rs[2]&&rs[2].ok?rs[2]:{items:[],unread:0};
      var works=(prof.works||[]);
      stat('bookmark',shelf.counts.wishlist,T('想读','Want'), '/index.html#myshelf-wishlist');
      stat('book',shelf.counts.reading,T('在读','Reading'),'/index.html#myshelf-reading');
      stat('check',shelf.counts.finished,T('读完','Finished'),'/index.html#myshelf-finished');
      stat('speech',prof.notes||0,T('想法','Thoughts'));
      stat('star',prof.reviews||0,T('书评','Reviews'));
      stat('note',works.length,T('作品','Works'),works.length?'#works':'https://write.evoronai.com/');
      if(works.length){
        var wk=el('div','sec');wk.id='works';
        var wh=el('h2','');wh.innerHTML='<img class="ico" src="assets/icons/note.png" alt=""> '+T('我的作品','My works');
        var wn=el('span','n',works.length+T(' 部',' published'));wh.appendChild(wn);
        wk.appendChild(wh);
        var wg=el('div','works');
        // v5.71 用户实弹：作品最多显示 12 部——首屏 12 部 + 「展开全部」补渲余下
        var WORKS_FOLD=12;
        function renderWork(w){
          var a2=el('a','wk');a2.href='/'+(w.url||('books/'+w.projectId+'/index.html'));
          var cv=el('div','cv');
          if(w.coverUrl){var ci=document.createElement('img');ci.src='/'+w.coverUrl;ci.alt='';cv.appendChild(ci)}
          else{cv.appendChild(el('span','',w.title||''))}
          a2.appendChild(cv);
          a2.appendChild(el('b','',w.title||''));
          a2.appendChild(el('small','',(w.category||'')+(w.chapterCount?' · '+w.chapterCount+T(' 章',' ch.'):'')));
          wg.appendChild(a2);
        }
        works.slice(0,WORKS_FOLD).forEach(renderWork);
        wk.appendChild(wg);
        if(works.length>WORKS_FOLD){
          var more=el('button','', T('展开全部 '+works.length+' 部','Show all '+works.length));
          more.style.cssText='margin:12px auto 0;display:block;border:1px solid var(--line);border-radius:17px;background:#fff;padding:7px 22px;font-size:13px;cursor:pointer;color:var(--ink)';
          more.onclick=function(){works.slice(WORKS_FOLD).forEach(renderWork);more.remove()};
          wk.appendChild(more);
        }
        main.appendChild(wk);
      }
      var items=noti.rows||[];
      var sec=el('div','sec');
      var h=el('h2','');h.innerHTML='<img class="ico" src="assets/icons/bell.png" alt=""> '+T('通知','Notifications');
      var n2=el('span','n',(noti.unread||0)+T(' 未读',' unread'));h.appendChild(n2);
      if(items.length){var rd=el('button','',T('全部已读','Mark all read'));rd.onclick=function(){j('/api/reader/notifications',{method:'POST'}).then(function(){location.reload()})};h.appendChild(rd)}
      sec.appendChild(h);
      if(!items.length)sec.appendChild(el('div','empty',T('暂无通知','No notifications yet')));
      items.slice(0,20).forEach(function(it){
        var r=el('div','nrow'+(it.read?'':' unread'));
        var t2=el('span','nt');t2.innerHTML='';
        var b2=el('b','',it.fromName||'');t2.appendChild(b2);
        var verb=it.type==='like'?T(' 赞了你',' liked your '):T(' 回复了你',' replied to your ');
        t2.appendChild(document.createTextNode(verb+(EN?({note:'thought',review:'review',reply:'reply'})[it.kind]||'':({note:'的想法',review:'的书评',reply:'的回复'})[it.kind]||'')+(it.bookTitle?' · '+it.bookTitle:'')+(it.text?'：'+it.text:'')));
        r.appendChild(t2);
        if(it.bookId){var g=el('a','',T('去看看','View'));g.href='/books/'+it.bookId+'/index.html';r.appendChild(g)}
        sec.appendChild(r);
      });
      main.appendChild(sec);
      var recent=(prof.recentReviews||[]);
      var sec2=el('div','sec');
      var h3=el('h2','');h3.innerHTML='<img class="ico" src="assets/icons/star.png" alt=""> '+T('我的最近书评','My recent reviews');sec2.appendChild(h3);
      if(!recent.length)sec2.appendChild(el('div','empty',T('还没写过书评——读完一本书去末章打分吧。','No reviews yet — finish a book and rate it.')));
      recent.slice(0,5).forEach(function(rv){
        var d=el('div','rv');
        var bk=el('div','bk',rv.bookTitle||T('（书目已下架）','(removed book)'));
        var st2=el('span','st','★★★★★'.slice(0,rv.rating||0));
        d.appendChild(bk);d.appendChild(st2);
        if(rv.text)d.appendChild(el('p','',rv.text));
        d.onclick=function(){if(rv.bookId)location.href='/books/'+rv.bookId+'/index.html'};
        sec2.appendChild(d);
      });
      main.appendChild(sec2);
    });
  }).catch(function(){main.innerHTML='<div class="empty">'+T('页面暂时打不开。','Temporarily unavailable.')+'</div>'});
})();
