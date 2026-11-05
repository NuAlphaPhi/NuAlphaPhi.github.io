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
 assert.equal(c.P985.searchButton().textContent,'Search 985…⌘ / Ctrl K');
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
