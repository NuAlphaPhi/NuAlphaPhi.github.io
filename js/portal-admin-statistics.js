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
    const people=P.rosterData?.people, disaffiliated=(people||[]).filter(p=>p.disaffiliated===true);
    const grid=P.el('div','p-stat-grid');
    for(const [label,value] of [['Portal accounts',accounts.length],['Online now',error?'—':online.size],['Active now',error?'—':active.length],['Disaffiliated',people?disaffiliated.length:'—']]) {
      const card=P.el('div','p-stat-card');card.append(P.el('span','p-muted',label),P.el('strong','',String(value)));grid.append(card);
    }
    root.append(grid,P.el('p','p-muted','Online: checked in within 2 minutes. Active: interacted within 5 minutes. Multiple tabs count as one brother.'));
    if(error)root.append(P.el('p','p-error','Live presence is unavailable. Try refreshing shortly.'));
    const live=P.el('section','p-stat-section');live.append(P.el('h3','','Online Brothers'));
    for(const [uid,session] of online){const person=accounts.find(a=>a.id===uid)||P.person(uid),row=P.el('div','p-stat-person');row.append(P.author(uid),P.el('span','p-muted',now-time(session.lastActiveAt)<300000?'Active now':'Idle'));live.append(row);}
    if(!online.size)live.append(P.el('p','p-muted',error?'Presence could not be loaded.':'No recent portal check-ins.'));
    root.append(live);
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
    disaffiliated.forEach(r=>{const b=P.rosterPerson?.(r.id)||r,row=P.el('div','p-stat-person');row.append(P.el('strong','',b.pledgeName||b.fullName),P.el('span','p-muted',[b.fullName,b.chapter,b.pledgeClass].filter(Boolean).join(' · ')));list.append(row);});root.append(list);
  };
  P.ready(()=>{
    const uid=P.uid,ref=db.collection('portalSessions').doc(),start=Date.now();let lastAction=start,lastSent=0,stopped=false;
    const activity=()=>{lastAction=Date.now();};
    const beat=()=>{if(stopped||P.uid!==uid||!P.accessReady||document.visibilityState==='hidden')return;const data={uid,lastSeenAt:P.stamp()};if(lastAction>lastSent)data.lastActiveAt=P.stamp();const sent=lastAction;ref.set(data,{merge:true}).then(()=>{lastSent=Math.max(lastSent,sent);}).catch(()=>{});};
    ['pointerdown','keydown','touchstart','scroll'].forEach(e=>document.addEventListener(e,activity,{passive:true,capture:true}));
    document.addEventListener('visibilitychange',beat);const timer=setInterval(beat,45000);beat();
    P.listeners.push(()=>{stopped=true;clearInterval(timer);ref.delete().catch(()=>{});document.removeEventListener('visibilitychange',beat);['pointerdown','keydown','touchstart','scroll'].forEach(e=>document.removeEventListener(e,activity,true));});
  });
})();
