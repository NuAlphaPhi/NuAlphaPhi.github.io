const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function setup(){
 const {document,window}=parseHTML(fs.readFileSync('portal-home.html','utf8'));
 const storage=new Map(),ready=[];
 const c={document,window,console,Map,Set,URL,Blob,crypto:require('node:crypto').webcrypto,Event:window.Event,CustomEvent:window.CustomEvent,
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  location:{hash:'#home',pathname:'/portal-home.html',search:''},history:{pushState(){},replaceState(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  firebase:{firestore:{FieldValue:{serverTimestamp:()=>123}}},auth:{onAuthStateChanged(){}},
  napOnAuthReady:fn=>ready.push(fn),napOnBrothersUpdated(){},NAP_ALL_BROTHERS:[],
  db:{},storage:{}};
 window.napOnAuthReady=c.napOnAuthReady;window.napOnBrothersUpdated=c.napOnBrothersUpdated;
 c.window.localStorage=c.localStorage;vm.createContext(c);
 vm.runInContext(fs.readFileSync('js/portal-985-core.js','utf8'),c);c.P985=window.P985;
 return c;
}
test('new portal modules initialize against the actual page markup',()=>{
 const c=setup();
 for(const file of ['portal-985-experience','portal-985-search','portal-985-settings','portal-985-feed','portal-985-profiles','portal-985-chat','portal-985-events','portal-985-roster','portal-985-admin']){
  assert.doesNotThrow(()=>vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),c,{filename:file}));
 }
 assert.ok(c.document.getElementById('p985-event-detail'));
 assert.equal(c.P985.searchButton().getAttribute('aria-label'),'Search the portal');
});
test('calendar exports preserve dates, escape user content and include a reminder',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-experience.js','utf8'),c);let result;
 c.P985.download=(name,body,type)=>result={name,body,type};
 c.P985.calendarFile({id:'gala',title:'Gala, 2026; chapter',description:'Line one\nLine two',location:'Boston',start:'2026-11-10T20:00:00Z'});
 assert.equal(result.type,'text/calendar');assert.match(result.body,/DTSTART:20261110T200000Z/);assert.match(result.body,/DTEND:20261110T210000Z/);assert.ok(result.body.includes('SUMMARY:Gala\\, 2026\\; chapter'));assert.match(result.body,/BEGIN:VALARM/);
});
test('attendee export neutralizes spreadsheet formulas and quotes fields',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-experience.js','utf8'),c);
 assert.equal(c.P985.csv([['=SUM(1,2)','Name "A"']]),'"\'=SUM(1,2)","Name ""A"""');
});
test('post management stays inside the options menu and editing opens correctly',()=>{
 const c=setup();c.db.doc=()=>({get:async()=>({exists:false,data:()=>({})})});
 vm.runInContext(fs.readFileSync('js/portal-985-feed.js','utf8'),c);
 const P=c.P985;P.uid='author';P.me={isAdmin:true};let closed=0;const dialogs=[];
 P.dialog=(title,content)=>{dialogs.push({title,content});return {close(){closed++;}};};
 const card=P.postCard({id:'one',authorUid:'author',authorName:'Brother',chapter:'Kappa',kind:'announcement',body:'Announcement',createdAt:123});
 assert.equal(card.textContent.includes('Edit post'),false);
 card.querySelector('.p-post-menu').click();
 assert.equal(dialogs[0].title,'Post options');
 const edit=[...dialogs[0].content.querySelectorAll('button')].find(b=>b.textContent==='Edit post');edit.click();
 assert.equal(closed,1);assert.equal(dialogs[1].title,'Edit post');
});
test('channel resume selects only accessible channels and otherwise falls back to General',()=>{
 const policy=require('../js/portal-985-policy.js');
 assert.equal(policy.resumeChannel({},'').id,'general');
 assert.equal(policy.resumeChannel({},'gaming').id,'gaming');
 assert.equal(policy.resumeChannel({},'nationals').id,'general');
 assert.equal(policy.resumeChannel({role:'nationalBoard'},'nationals').id,'nationals');
});
test('recipient picker reveals the group name only for multiple recipients',()=>{
 const c=setup(),P=c.P985;
 vm.runInContext(fs.readFileSync('js/portal-985-chat.js','utf8'),c);
 P.uid='me';P.brothers=[{uid:'one',pledgeName:'One',chapter:'Alpha'},{uid:'two',pledgeName:'Two',chapter:'Beta'}];
 let dialog;
 P.dialog=(title,content)=>{dialog=c.document.createElement('dialog');const header=c.document.createElement('div');header.className='p-row';header.append(c.document.createElement('button'));dialog.append(header,content);c.document.body.append(dialog);return dialog;};
 P.newConversation();
 const field=dialog.querySelector('input[aria-label="Group Name"]').parentElement;
 assert.equal(field.hidden,true);assert.equal(dialog.querySelector('.p-message-start').disabled,true);
 dialog.querySelectorAll('.p-recipient-row')[0].click();assert.equal(field.hidden,true);
 dialog.querySelectorAll('.p-recipient-row')[1].click();assert.equal(field.hidden,false);
 assert.equal(dialog.querySelectorAll('.p-recipient-chip').length,2);
 dialog.querySelector('.p-recipient-chip').click();assert.equal(field.hidden,true);
});
test('entering Channels opens General, then restores the last channel after leaving',()=>{
 const c=setup(),P=c.P985,paths=[];
 const query={where(){return this;},orderBy(){return this;},limit(){return this;},doc(){return this;},onSnapshot(){return ()=>{};},set:async()=>{}};
 c.db.collection=path=>{paths.push(path);return query;};c.db.doc=()=>query;
 P.watch=()=>()=>{};P.photoAttachment=()=>({clear(){}});
 c.P985Policy=require('../js/portal-985-policy.js');P.uid='member';P.accessReady=true;P.grant={};
 P.go=tab=>{c.document.querySelectorAll('[data-panel]').forEach(e=>e.hidden=e.dataset.panel!==tab);c.document.dispatchEvent(new c.CustomEvent('nap:tab-changed',{detail:{tab}}));};
 vm.runInContext(fs.readFileSync('js/portal-985-chat.js','utf8'),c);
 P.go('channels');assert.ok(paths.includes('socialChannels/general/messages'));
 const gaming=[...c.document.querySelectorAll('.p-channel-group-rooms button')].find(b=>b.textContent.includes('Gaming'));gaming.click();
 assert.equal(c.localStorage.getItem('985.lastChannel.member'),'gaming');
 P.go('home');paths.length=0;P.go('channels');assert.ok(paths.includes('socialChannels/gaming/messages'));
});
test('chapter preview follows draft content, color and link changes and saves chosen background',async()=>{
 const c=setup();let ready, saved, draft;
 c.location.origin="https://nualphaphi.com";
 c.document.getElementById("linktreeLivePreview").contentWindow={postMessage(message){draft=message.doc;}};
 c.window.NAP_CHAPTERS=['Kappa'];c.window.napIsAdmin=()=>true;c.window.napOnAuthReady=fn=>ready=fn;c.window.napSetTab=()=>{};
 c.window.napSaveButtonStart=()=>{};c.window.napSaveButtonDone=()=>{};
 c.db.collection=name=>({onSnapshot(fn){if(name==='chapterLinktrees')fn({forEach(cb){cb({id:'Kappa',data:()=>({displayName:'Kappa',backgroundColor:'#112233',links:[{id:'one',title:'Website',url:'https://example.com'}]})});}});else fn({docs:[]});},doc:()=>({set:async value=>{saved=value;}})});
 vm.runInContext(fs.readFileSync('js/portal-linktree.js','utf8'),c);ready({uid:'admin'});
 c.document.querySelector('[data-chapter-open]').click();
 const preview=c.document.getElementById('linktreeLivePreview');
 assert.match(preview.src,/kappa\.html\?preview=1/);assert.equal(draft.backgroundColor,'#112233');
 assert.equal(c.document.getElementById('linktreeChapterPageUrl').getAttribute('href'),'https://nualphaphi.com/kappa');
 const name=c.document.getElementById('linktree-display-name');name.value='<img src=x onerror=alert(1)>';name.dispatchEvent(new c.Event('input',{bubbles:true}));
 assert.equal(draft.displayName,name.value);
 const color=c.document.getElementById('linktree-color-hex');color.value='#ffffff';color.dispatchEvent(new c.Event('input',{bubbles:true}));
 assert.equal(draft.backgroundColor,'#ffffff');
 c.document.querySelector('[data-remove-link]').click();assert.equal(draft.links.length,0);
 c.document.getElementById('linktreeChapterForm').dispatchEvent(new c.Event('submit',{cancelable:true}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(saved.backgroundColor,'#ffffff');assert.equal(saved.links.length,0);
});
test('embedded and public chapter pages use the same rendering and reject outside draft messages',()=>{
 const html=fs.readFileSync('kappa.html','utf8'),script=fs.readFileSync('js/linktree.js','utf8');
 const doc={displayName:'Kappa <chapter>',subtitle:'Our chapter',backgroundColor:'#000000',links:[{title:'Website',url:'https://example.com'},{title:'Unsafe',url:'javascript:alert(1)'}]};
 function load(preview){
  const {document}=parseHTML(html);const window={};let handler,reads=0;const parent={};
  window.NAP_LINKTREE_CHAPTER='Kappa';window.parent=preview?parent:window;window.addEventListener=(type,fn)=>{if(type==='message')handler=fn;};
  const c={document,window,URL,URLSearchParams,location:{origin:'https://nualphaphi.com',search:preview?'?preview=1':''},db:{collection(){reads++;return {doc:()=>({onSnapshot(fn){fn({exists:true,data:()=>doc});}})};}}};
  vm.createContext(c);vm.runInContext(script,c);return {document,reads,send(origin,source=parent){handler({origin,source,data:{type:'nap:chapter-preview',chapter:'Kappa',doc}});}};
 }
 const live=load(false),preview=load(true);assert.equal(preview.reads,0);
 preview.send('https://evil.example');assert.notEqual(preview.document.getElementById('linktreeTitle').textContent,doc.displayName);
 preview.send('https://nualphaphi.com',{});assert.notEqual(preview.document.getElementById('linktreeTitle').textContent,doc.displayName);
 preview.send('https://nualphaphi.com');
 for(const id of ['linktreeTitle','linktreeSubtitle','linktreeAvatar','linktreeLinks'])assert.equal(preview.document.getElementById(id).innerHTML,live.document.getElementById(id).innerHTML);
 assert.equal(preview.document.body.getAttribute('style'),live.document.body.getAttribute('style'));
 assert.equal(preview.document.querySelectorAll('.linktree-link').length,1);
 assert.equal(preview.document.getElementById('linktreeTitle').querySelector('chapter'),null);
});
test('event detail separates organizer actions from RSVP and conversation',async()=>{
 const c=setup(),P=c.P985;P.uid='host';P.me={isAdmin:true};
 c.window.napSetTab=()=>{};P.ready=()=>{};
 c.db.doc=()=>({get:async()=>({exists:true,data:()=>({title:'Chapter meetup',hostUid:'host',status:'published',start:123,deadline:456,description:'Meet the brothers',location:'Campus',plusOnes:true})})});
 P.image=()=>c.document.createElement('img');P.author=()=>c.document.createElement('span');P.eventTools=()=>{};
 P.event=async action=>action==='attendance'?{status:'going',partySize:1}:action==='conversation'?{attendeesUnlocked:true,rows:[]}: {rows:[]};
 P.select=(label,options,value)=>P.field(label,'text',value);
 let pending;P.run=(box,fn)=>{pending=fn();return pending;};
 vm.runInContext(fs.readFileSync('js/portal-985-events.js','utf8'),c);P.openEvent('one');await pending;
 assert.equal(c.document.querySelector('.p-event-hero h1').textContent,'Chapter meetup');
 const menu=c.document.querySelector('.p-event-management-menu');assert.match(menu.textContent,/Delete event/);assert.match(menu.textContent,/Send attendee announcement/);
 assert.ok(c.document.querySelector('.p-event-body>.p-event-rsvp'));assert.ok(c.document.querySelector('.p-event-body>.p-event-community'));
 assert.match(c.document.querySelector('.p-event-rsvp').textContent,/Save RSVP/);
});
test('roster class leadership uses full class order with one captain for a solo class',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-roster.js','utf8'),c);
 const roles=c.P985.rosterClassRoles([{id:'first'},{id:'middle'},{id:'last'}]);
 assert.equal(roles.get('first'),'Captain');assert.equal(roles.get('last'),'Co-Captain');assert.equal(roles.has('middle'),false);
 assert.deepEqual([...c.P985.rosterClassRoles([{id:'solo'}])],[['solo','Captain']]);assert.equal(c.P985.rosterClassRoles([]).size,0);
});
test('profile lineage derives big and all littles from verified tree links, never legacy text',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-profiles.js','utf8'),c);const P=c.P985;
 const b={uid:'bro',firstName:'Aiden',lastName:'Yue',pledgeName:'VIRO',chapter:'Kappa',big:'Wrong Big',littles:['Wrong Little']};
 const data={accountLinks:{bro:{rosterID:'roster'}},links:{roster:{treeID:'viro'}},tree:[{id:'viro',name:'Aiden Yue',pledgeName:'VIRO',chapter:'Kappa',bigId:'parent'},{id:'parent',name:'Big Name',pledgeName:'Big'},{id:'one',bigId:'viro',pledgeName:'Little One'},{id:'two',bigId:'viro',pledgeName:'Little Two'}]};
 let f=P.profileLineage(b,data);assert.equal(f.big.id,'parent');assert.deepEqual(Array.from(f.littles,x=>x.id),['one','two']);
 data.tree[2].bigId='parent';f=P.profileLineage(b,data);assert.equal(f.littles.length,1);
 data.tree[0].bigId='missing';assert.equal(P.profileLineage(b,data).big,null);
 data.tree=data.tree.filter(n=>n.id!=='viro');assert.equal(P.profileLineage(b,data).status,'unmatched');
});
test('unlinked profiles need a complete unique chapter/name match and do not guess on ambiguity',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-profiles.js','utf8'),c);const P=c.P985,b={uid:'bro',firstName:'Aiden',lastName:'Yue',pledgeName:'VIRO',chapter:'Kappa'},node={id:'one',name:'Aiden Yue',pledgeName:'VIRO',chapter:'Kappa'};
 assert.equal(P.profileLineage(b,{tree:[node]}).status,'linked');
 assert.equal(P.profileLineage(b,{tree:[node,{...node,id:'two'}]}).status,'unmatched');
 assert.equal(P.profileLineage(b,{tree:[{...node,chapter:'Alpha'}]}).status,'unmatched');
 assert.equal(P.profileLineage({...b,lastName:''},{tree:[node]}).status,'unmatched');
 assert.equal(P.profileLineage(b,undefined).status,'loading');
});
test('profile settings no longer offer manually editable big/little fields',()=>{
 const c=setup();assert.equal(c.document.querySelector('[name="bigName"]'),null);assert.equal(c.document.querySelector('[name="bigPledgeName"]'),null);
 const code=fs.readFileSync('js/portal-settings.js','utf8');assert.ok(!code.includes('"bigName"'));assert.ok(!code.includes('"bigPledgeName"'));
});
test('post metadata is compact while preserving exact timestamps for inspection',()=>{
 const c=setup();c.db.doc=()=>({get:async()=>({exists:false})});vm.runInContext(fs.readFileSync('js/portal-985-feed.js','utf8'),c);
 const post={id:'one',authorUid:'other',authorName:'VIRO',chapter:'Kappa',kind:'announcement',body:'Hello',createdAt:'2026-11-04T19:12:00Z',editedAt:'2026-11-05T06:50:00Z'};
 const card=c.P985.postCard(post),meta=card.querySelector('.p-post-meta');
 assert.match(meta.textContent,/Kappa · Nov 4/);assert.match(meta.textContent,/edited/);assert.ok(!meta.textContent.includes('announcement'));assert.ok(!meta.textContent.includes('AM'));assert.match(meta.title,/Posted .* · Edited /);assert.equal(card.querySelectorAll(':scope > small').length,1);
});

test('shared editor labels capitalize camel case and spaced field names',()=>{
 const c=setup();
 for (const label of ['firstName','first Name','last Name','pledge Number']) {
  const field=c.P985.field(label);
  assert.match(field.wrap.firstChild.textContent,/^[A-Z]/);
  assert.equal(field.input.getAttribute('aria-label'),field.wrap.firstChild.textContent);
 }
 assert.equal(c.P985.field('firstName').input.getAttribute('aria-label'),'First Name');
});
test('every portal navigation section has a direct static entry',()=>{
 const html=fs.readFileSync('portal-home.html','utf8');
 for(const [,tab] of html.matchAll(/data-tab="([^"]+)"/g)) assert.ok(fs.existsSync(`portal-home/${tab}/index.html`),tab);
 assert.ok(fs.existsSync('portal-home/index.html'));
});

test('class crossing dates derive only from the same chapter and class',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-roster.js','utf8'),c);
 const cls={chapter:'Alpha',pledgeClass:'Alpha'};
 const tree=[{chapter:'Alpha',pledgeClass:'Alpha Class',term:'fall',year:1994},{chapter:'Alpha',pledgeClass:'Alpha',term:'Fall',year:'1994'},{chapter:'Kappa',pledgeClass:'Alpha',term:'Spring',year:2026}];
 const r=c.P985.rosterClassCrossing(cls,tree);assert.equal(r.label,'Fall 1994');assert.equal(r.conflict,false);assert.equal(r.nodes.length,2);
});
test('conflicting class crossing dates never silently select a semester',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-roster.js','utf8'),c);
 const cls={chapter:'Alpha',pledgeClass:'Alpha'},base={chapter:'Alpha',pledgeClass:'Alpha'};
 const r=c.P985.rosterClassCrossing(cls,[{...base,term:'Fall',year:1994},{...base,term:'Spring',year:1995}]);
 assert.equal(r.label,'');assert.equal(r.conflict,true);
 const missing=c.P985.rosterClassCrossing(cls,[{...base,term:'Fall'}]);assert.equal(missing.label,'');assert.equal(missing.missing.length,1);
 const saved=c.P985.rosterClassCrossing({...cls,semesterCrossed:'Summer',yearCrossed:1995},[{...base,term:'Fall',year:1994}]);assert.equal(saved.conflict,true);
});

test('notification inbox closes outside, stays open inside, and keeps bell state in sync',()=>{
 const c=setup();vm.runInContext(fs.readFileSync('js/portal-985-chat.js','utf8'),c);
 const bell=c.document.getElementById('notificationBellBtn'),panel=c.document.getElementById('notificationDropdown');
 bell.click();assert.equal(panel.hidden,false);assert.equal(bell.getAttribute('aria-expanded'),'true');
 panel.dispatchEvent(new c.Event('pointerdown',{bubbles:true}));assert.equal(panel.hidden,false);
 const unread=panel.querySelectorAll('.p-notification-filter')[1];unread.click();assert.equal(panel.hidden,false);
 c.document.body.dispatchEvent(new c.Event('pointerdown',{bubbles:true}));assert.equal(panel.hidden,true);assert.equal(bell.getAttribute('aria-expanded'),'false');
 bell.click();assert.equal(panel.hidden,false);bell.click();assert.equal(panel.hidden,true);
});
