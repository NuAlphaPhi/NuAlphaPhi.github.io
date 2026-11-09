(function () {
  'use strict';
  const P = P985;
  const time = value => value ? P.date(value).getTime() : 0;
  P.renderAdminStatistics = function (root, accounts, sessions, error) {
    if (!P.me.isAdmin) return;
    const now = Date.now(), online = new Map();
    sessions.forEach(s => {
      if (now-time(s.lastSeenAt)>120000) return;
      const old=online.get(s.uid);
      if (!old || time(s.lastActiveAt)>time(old.lastActiveAt)) online.set(s.uid,s);
    });
    const active=[...online.values()].filter(s=>now-time(s.lastActiveAt)<300000);
    const people=P.rosterData?.people, disaffiliated=(people||[]).filter(p=>p.disaffiliated===true), fallen=(people||[]).filter(p=>p.fallen===true).sort((a,b)=>(a.fullName||a.pledgeName||'').localeCompare(b.fullName||b.pledgeName||''));
    const grid=P.el('div','p-stat-grid');
    for(const [label,value] of [['Portal accounts',accounts.length],['Online now',error?'—':online.size],['Active now',error?'—':active.length],['Disaffiliated',people?disaffiliated.length:'—'],['Fallen Brothers (RIP)',people?fallen.length:'—']]) {
      const card=P.el('div','p-stat-card');card.append(P.el('span','p-muted',label),P.el('strong','',String(value)));grid.append(card);
    }
    root.append(grid,P.el('p','p-muted','Online: checked in within 2 minutes. Active: interacted within 5 minutes. Multiple tabs count as one brother.'));
    if(error)root.append(P.el('p','p-error','Live presence is unavailable. Try refreshing shortly.'));
    const live=P.el('section','p-stat-section');live.append(P.el('h3','','Online Brothers'));
    for(const [uid,session] of online){const person=accounts.find(a=>a.id===uid)||P.person(uid),row=P.el('div','p-stat-person');row.append(P.author(uid),P.el('span','p-muted',now-time(session.lastActiveAt)<300000?'Active now':'Idle'));live.append(row);}
    if(!online.size)live.append(P.el('p','p-muted',error?'Presence could not be loaded.':'No recent portal check-ins.'));
    root.append(live);
    const memorial=P.el('section','p-stat-section');
    memorial.append(P.el('h3','','Fallen Brothers · Rest in Peace'));
    if(!people)memorial.append(P.el('p','p-muted','Loading roster…'));
    else if(!fallen.length)memorial.append(P.el('p','p-muted','No fallen brothers are marked in the roster.'));
    else memorial.append(P.el('p','p-muted',`${fallen.length} fallen brother${fallen.length===1?'':'s'} remembered in our master roster.`));
    fallen.forEach(r=>{
      const b=P.rosterPerson?.(r.id)||r,c=P.rosterData?.classes?.find(c=>c.id===r.classID),row=P.el('div','p-stat-person');
      const name=b.fullName||r.fullName||'Brother',pledge=b.pledgeName||r.pledgeName;
      row.append(P.button(pledge?`${name} “${pledge}”`:name,()=>P.profile('roster_'+r.id),'p-name'),P.el('span','p-muted',[b.chapter||c?.chapter,b.pledgeClass||c?.pledgeClass,'RIP'].filter(Boolean).join(' · ')));
      memorial.append(row);
    });
    root.append(memorial);
    const growth=P.el('section','p-stat-section');growth.append(P.el('h3','','Portal Growth'),P.el('p','p-muted','New accounts by month · Last 12 months'));
    const months=Array.from({length:12},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-11+i);return {key:d.getFullYear()+'-'+d.getMonth(),label:d.toLocaleDateString(undefined,{month:'short',year:'numeric'}),count:0};});
    let undated=0;
    accounts.forEach(a=>{if(!time(a.createdAt)){undated++;return;}const d=P.date(a.createdAt),m=months.find(m=>m.key===d.getFullYear()+'-'+d.getMonth());if(m)m.count++;});
    const max=Math.max(1,...months.map(m=>m.count));
    months.forEach(m=>{const row=P.el('div','p-stat-growth'),track=P.el('div','p-stat-track'),bar=P.el('div');bar.style.width=(100*m.count/max)+'%';track.append(bar);row.append(P.el('span','',m.label),track,P.el('strong','',String(m.count)));growth.append(row);});
    if(undated)growth.append(P.el('small','p-muted',`${undated} accounts have no creation date and are excluded from the chart.`));root.append(growth);
    const list=P.el('section','p-stat-section');list.append(P.el('h3','','Disaffiliated Brothers'));
    if(!people)list.append(P.el('p','p-muted','Loading roster…'));
    else if(!disaffiliated.length)list.append(P.el('p','p-muted','No disaffiliated records.'));
    disaffiliated.forEach(r=>{const b=P.rosterPerson?.(r.id)||r,row=P.el('div','p-stat-person');row.append(P.el('strong','',b.pledgeName||b.fullName),P.el('span','p-muted',[b.fullName,b.chapter,b.pledgeClass].filter(Boolean).join(' · ')));const noteButton=P.button('Admin note',()=>editPrivateNote(r.id,b),'p-btn');row.append(noteButton);list.append(row);});root.append(list);
  };
  async function editPrivateNote(id, brother) {
    if (!P.me?.isAdmin) return;
    const box=P.el('form','p-private-note'),label=P.el('label'),input=P.el('textarea'),status=P.el('p','p-muted','Loading private note…');
    input.rows=5;input.maxLength=5000;input.placeholder='Add a reason or internal note';input.disabled=true;
    label.append(P.el('span','','Reason / Note'),input);
    const save=P.el('button','p-btn p-primary','Save note');save.type='submit';save.disabled=true;
    box.append(P.el('p','p-muted','Only administrators can view or edit this note.'),label,status,save);
    const dialog=P.dialog('Admin note · '+(brother.pledgeName||brother.fullName),box);
    const ref=db.collection('disaffiliationNotes').doc(id);
    try {
      const snapshot=await ref.get();input.value=snapshot.exists?snapshot.data().note||'':'';
      status.textContent='';input.disabled=false;save.disabled=false;
    } catch (_) {status.textContent='Could not load the note. Close and try again.';return;}
    box.onsubmit=e=>{e.preventDefault();P.run(box,async()=>{
      save.disabled=true;
      try {await ref.set({note:input.value.trim(),updatedBy:P.uid,updatedAt:P.stamp()});dialog.close();}
      finally {save.disabled=false;}
    });};
  }
  P.ready(()=>{
    const uid=P.uid,ref=db.collection('portalSessions').doc(),start=Date.now();let lastAction=start,lastSent=0,stopped=false;
    const activity=()=>{lastAction=Date.now();};
    const beat=()=>{if(stopped||P.uid!==uid||!P.accessReady||document.visibilityState==='hidden')return;const data={uid,lastSeenAt:P.stamp()};if(lastAction>lastSent)data.lastActiveAt=P.stamp();const sent=lastAction;ref.set(data,{merge:true}).then(()=>{lastSent=Math.max(lastSent,sent);}).catch(()=>{});};
    ['pointerdown','keydown','touchstart','scroll'].forEach(e=>document.addEventListener(e,activity,{passive:true,capture:true}));
    document.addEventListener('visibilitychange',beat);const timer=setInterval(beat,45000);beat();
    P.listeners.push(()=>{stopped=true;clearInterval(timer);ref.delete().catch(()=>{});document.removeEventListener('visibilitychange',beat);['pointerdown','keydown','touchstart','scroll'].forEach(e=>document.removeEventListener(e,activity,true));});
  });
})();
