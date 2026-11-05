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
 const field=dialog.querySelector('input[aria-label="Group name"]').parentElement;
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
