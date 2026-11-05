(function(){'use strict';const P=P985;P.ready(()=>{
 const root=document.getElementById('settingsNotificationsPanel'),box=P.el('section','p985 p-card');root.append(box);
 box.append(P.el('h2','','Notification preferences'),P.el('p','p-muted','Choose alerts for your 985 devices. Quiet hours silence push alerts; your inbox keeps the updates.'));
 const fields={};
 P.run(box,async()=>{
  const [prefs,control]=await Promise.all([db.doc('notificationPreferences/'+P.uid).get(),db.doc('notificationControls/'+P.uid).get()]);
  for(const [key,label] of Object.entries({announcements:'Announcements',events:'Events',mentions:'Mentions',directMessages:'Direct messages',groupMessages:'Group messages',replies:'Replies',newPosts:'New posts'})){
   const f=P.field(label,'checkbox');f.input.checked=prefs.data()?.[key]??key!=='newPosts';fields[key]=f.input;box.append(f.wrap);
  }
  const quiet=P.field('Enable quiet hours','checkbox'),start=P.field('Quiet hours start','time'),end=P.field('Quiet hours end','time');
  const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');quiet.input.checked=control.data()?.quietEnabled===true;start.input.value=fmt(control.data()?.startMinute??1320);end.input.value=fmt(control.data()?.endMinute??480);
  box.append(quiet.wrap,start.wrap,end.wrap,P.el('p','p-muted','Time zone: '+Intl.DateTimeFormat().resolvedOptions().timeZone),P.button('Save preferences',()=>P.run(box,async()=>{
   const minutes=v=>Number(v.split(':')[0])*60+Number(v.split(':')[1]);if(!start.input.value||!end.input.value)throw Error('Choose the start and end of quiet hours.');
   const batch=db.batch();batch.set(db.doc('notificationPreferences/'+P.uid),Object.fromEntries(Object.entries(fields).map(([k,i])=>[k,i.checked])));batch.set(db.doc('notificationControls/'+P.uid),{quietEnabled:quiet.input.checked,startMinute:minutes(start.input.value),endMinute:minutes(end.input.value),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});await batch.commit();P.toast('Preferences saved');
  }),'p-btn primary'));
 });
});})();
