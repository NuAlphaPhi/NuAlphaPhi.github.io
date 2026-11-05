/* Search only collections that the signed-in member is permitted to read. */
(function () {
  'use strict';
  const P = P985;
  let albums = [], roster = [], fullPosts = [], dialog, resultRoot, input;
  let loaded = false, generation = 0;
  const key = () => '985.search.' + P.uid;
  function history() { try { return JSON.parse(localStorage.getItem(key()) || '[]'); } catch (_) { return []; } }
  function remember(value) { try { localStorage.setItem(key(), JSON.stringify([value, ...history().filter(x => x !== value)].slice(0, 8))); } catch (_) {} }
  function records() {
    return [
      ...P.brothers.filter(b => !P.blocks.has(b.uid)).map(b => ({group:'Brothers', title:P.name(b), detail:[b.firstName,b.lastName,b.chapter,b.pledgeClass].filter(Boolean).join(' · '), open:()=>P.profile(b.uid)})),
      ...(fullPosts.length ? fullPosts : P.posts).filter(p=>!P.blocks.has(p.authorUid)).map(p=>({group:'Posts',title:p.body || 'Photo or poll',detail:P.name(P.person(p.authorUid)),open:()=>P.openPost(p.id)})),
      ...(P.events || []).map(e=>({group:'Events',title:e.title,detail:e.location || '',open:()=>P.openEvent(e.id)})),
      ...albums.map(a=>({group:'Albums',title:a.title,detail:a.description || '',open:()=>window.napOpenAlbum(a.id)})),
      ...roster.map(r=>({group:'Roster',title:r.pledgeName || r.fullName || r.realName || r.name || 'Roster entry',detail:[r.fullName,r.realName,(P.rosterData?.classes||[]).find(c=>c.id===r.classID)?.chapter,(P.rosterData?.classes||[]).find(c=>c.id===r.classID)?.pledgeClass,r.chapter,r.pledgeClass,r.className].filter(Boolean).join(' · '),open:()=>{P.go('roster'); const field=P.root('roster')?.querySelector('input[type="search"],input'); if(field){field.value=r.pledgeName || r.realName || '';field.dispatchEvent(new Event('input'));}}}))
    ];
  }
  function draw() {
    if(!resultRoot?.isConnected) return;
    resultRoot.replaceChildren();
    const q=input.value.trim().toLowerCase();
    if(!q){
      let recent=[];try{recent=JSON.parse(localStorage.getItem(key()+'.items')||'[]');}catch(_){}
      const available=records();
      if(recent.length)resultRoot.append(P.el('h3','','Recently opened'));
      recent.forEach(item=>{const r=available.find(r=>r.group===item.group&&r.title===item.title&&r.detail===item.detail);if(r)resultRoot.append(P.button(r.group+' · '+r.title.slice(0,80),()=>{dialog.close();r.open();},'p-search-result'));});
      resultRoot.append(P.el('h3','','Recent searches'));
      history().forEach(v=>resultRoot.append(P.button(v,()=>{input.value=v;draw();},'p-search-result')));
      if(!history().length)resultRoot.append(P.empty('Find a brother, post, event, album, or roster entry.'));
      if(history().length)resultRoot.append(P.button('Clear history',()=>{localStorage.removeItem(key());draw();}));
      return;
    }
    const matches=records().filter(r=>(r.title+' '+r.detail).toLowerCase().includes(q));
    for(const group of ['Brothers','Posts','Events','Albums','Roster']) {
      const rows=matches.filter(r=>r.group===group);if(!rows.length)continue;
      resultRoot.append(P.el('h3','',group+' · '+rows.length));
      rows.slice(0,20).forEach(r=>{
        const b=P.button('',()=>{remember(input.value.trim());let items=[];try{items=JSON.parse(localStorage.getItem(key()+'.items')||'[]');localStorage.setItem(key()+'.items',JSON.stringify([{group:r.group,title:r.title,detail:r.detail},...items.filter(x=>x.title!==r.title||x.group!==r.group)].slice(0,6)));}catch(_){}dialog.close();r.open();},'p-search-result');
        b.append(P.el('strong','',r.title.slice(0,160)),P.el('small','p-muted',r.detail));resultRoot.append(b);
      });
    }
    if(!matches.length)resultRoot.append(P.empty(loaded?'No matches. Try a name, chapter, or different phrase.':'Searching…'));
  }
  P.search = () => {
    if(dialog?.open){input.focus();return;}
    const box=P.el('div','p-global-search'), field=P.field('Search the portal','search');
    input=field.input;input.placeholder='Brothers, posts, events, albums, roster…';
    resultRoot=P.el('div','p-search-results');resultRoot.setAttribute('aria-live','polite');
    box.append(field.wrap,resultRoot);dialog=P.dialog('Search 985',box);
    input.oninput=draw;draw();input.focus();
    const run=++generation;
    if(!loaded)Promise.all([
      db.collection('galleryAlbums').get(),db.collection('masterRoster').get(),db.collection('forumPosts').get()
    ]).then(([a,r,p])=>{if(run!==generation)return;const map=s=>s.docs.map(d=>({...d.data(),id:d.id}));albums=map(a);roster=map(r);fullPosts=map(p);loaded=true;draw();}).catch(e=>P.error(box,e));
    dialog.cleanup=()=>{loaded=false;};
  };
  P.searchButton=()=>{
    const b=P.button('Search 985…',P.search,'p-search-launch');
    b.append(P.el('kbd','','⌘ / Ctrl K'));return b;
  };
  document.addEventListener('keydown',e=>{if(P.uid&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();P.search();}});
  document.addEventListener('p985:blocks',draw);
})();
