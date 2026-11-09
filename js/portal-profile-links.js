(function(){
 const P=P985;
 const symbols={'₩':'W','Ø':'O','ø':'o','₡':'C','¢':'c','Ł':'L','ł':'l','Đ':'D','đ':'d','Ð':'D','ð':'d','Þ':'Th','þ':'th','Æ':'AE','æ':'ae','Œ':'OE','œ':'oe','ß':'ss','¥':'Y','$':'S','€':'E','₱':'P','Ŧ':'T','ŧ':'t','ı':'i'};
 P.profileSlug=value=>String(value||'').replace(/[₩Øø₡¢ŁłĐđÐðÞþÆæŒœß¥$€₱Ŧŧı]/g,c=>symbols[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 let resolved='';
 function resolve(){
  const match=location.pathname.match(/^\/portal\/profile\/([^/]+)\/?$/);if(!match||!P.uid||window.napCurrentTab!=='profile')return;
  let slug;try{slug=P.profileSlug(decodeURIComponent(match[1]));}catch{return;}
  const root=P.root('profile');
  if(!P.rosterData){root.replaceChildren(P.empty('Loading brother profiles…'));return;}
  const candidates=[...P.brothers];if(!candidates.some(b=>b.uid===P.uid))candidates.push({...P.me,uid:P.uid});
  const linked=new Set(Object.values(P.rosterData.accountLinks||{}).map(l=>l.rosterID));
  for(const r of P.rosterData.people){const b=P.rosterPerson(r.id);if(!b||linked.has(r.id))continue;
   const norm=v=>String(v||'').normalize('NFKC').trim().toLowerCase();
   if(candidates.some(a=>a.chapter===b.chapter&&norm(a.pledgeName)===norm(b.pledgeName)&&norm([a.firstName,a.middleName,a.lastName].filter(Boolean).join(' '))===norm(b.fullName)))continue;
   candidates.push(b);
  }
  const matches=candidates.filter(b=>slug&&P.profileSlug(b.pledgeName)===slug);
  if(matches.length===1){const b=matches[0],key=location.pathname+':'+b.uid;if(key===resolved)return;resolved=key;P.profile(b.uid,{fromRoute:true});return;}
  resolved='';root.replaceChildren();root.append(P.el('h1','',matches.length?'Choose a brother':'Profile not found'),P.el('p','p-muted',matches.length?'These pledge names share the same link spelling. Choose the chapter and name below.':'Check the pledge name or find this brother in the directory.'));
  matches.forEach(b=>root.append(P.button((b.fullName||[b.firstName,b.middleName,b.lastName].filter(Boolean).join(' '))+' · @'+b.pledgeName+' · '+b.chapter,()=>P.profile(b.uid,{fromRoute:true}))));
  root.append(P.button('Open directory',()=>P.go('directory')));
 }
 document.addEventListener('nap:tab-changed',()=>{if(window.napCurrentTab!=='profile')resolved='';resolve();});
 document.addEventListener('p985:people',resolve);document.addEventListener('p985:roster',resolve);P.ready(()=>{if(/^\/portal\/profile\/[^/]+\/?$/.test(location.pathname))window.napSetTab('profile',undefined,{fromHistory:true});});
})();
