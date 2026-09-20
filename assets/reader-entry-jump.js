(function(){try{
var node=document.getElementById('evoron-reader-entry');if(!node)return;
var D=JSON.parse(node.textContent);
var policy=(function readerEditionPolicy() {
  const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
  function releaseOf(record) {
    const id = record && (record.releaseId || record.anchor?.releaseId
      || String(record.href || '').split('/releases/')[1]?.split('/')[0]);
    return validId(id) ? id : '';
  }
  function chapterFor(record, releaseId, titles) {
    if (!record) return -1;
    const source = releaseOf(record);
    if (source && source !== releaseId) {
      if (!record.chapterTitle) return -1;
      const hits = titles.map((title, i) => title === record.chapterTitle ? i : -1).filter(i => i >= 0);
      return hits.length === 1 ? hits[0] : -1;
    }
    const index = Number(record.chapter);
    return Number.isInteger(index) && index >= 0 && index < titles.length ? index : -1;
  }
  const checkpointKey = (key, releaseId) => key.replace(/^historyai\.reader\./, 'historyai.reader-edition.') + '.' + releaseId;
  return { validId, releaseOf, chapterFor, checkpointKey };
})();
var key=D.key;
var s=JSON.parse(localStorage.getItem(key)||'{}');
var releaseId=D.releaseId||(location.pathname.split('/releases/')[1]||'').split('/')[0];
if(policy.releaseOf(s)&&policy.releaseOf(s)!==releaseId){
  var saved=JSON.parse(localStorage.getItem(policy.checkpointKey(key,releaseId))||'null');
  if(saved&&policy.releaseOf(saved)===releaseId)s=saved;
}
var links=D.links;
var i=policy.chapterFor(s,releaseId,D.titles);
if(i>0&&links[i]){window.__haiReaderEntryRedirecting=true;location.replace(links[i]);}
}catch(e){}})();