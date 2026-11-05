const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function setup(saved){
 const {document,window}=parseHTML('<html><body><button id="previous">Work</button></body></html>');
 let now=1000000,callback,tick,signedOut=0;const values=new Map(saved?[['985.activity.member',String(saved)]]:[]);
 const create=document.createElement.bind(document);document.createElement=tag=>{const el=create(tag);if(tag==='dialog'){el.showModal=()=>el.setAttribute('open','');el.close=()=>el.removeAttribute('open');}return el;};
 const c={document,window,Date:{now:()=>now},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},setInterval:fn=>(tick=fn,1),clearInterval(){tick=null},auth:{onAuthStateChanged:fn=>callback=fn,signOut:async()=>{signedOut++;callback(null);}}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/portal-idle.js','utf8'),c);callback({uid:'member'});
 return {document,window,values,advance:ms=>{now+=ms;tick?.();},activity:()=>document.dispatchEvent(new window.Event('pointerdown')),signedOut:()=>signedOut,now:()=>now};
}
test('warns at ten minutes, counts down three more minutes, and signs out',()=>{
 const s=setup();s.advance(599999);assert.equal(s.document.querySelector('dialog'),null);s.advance(1);
 assert.match(s.document.querySelector('.nap-idle-countdown').textContent,/3:00/);s.advance(179000);assert.match(s.document.querySelector('.nap-idle-countdown').textContent,/0:01/);s.advance(1000);assert.equal(s.signedOut(),1);
});
test('activity dismisses the warning and starts a fresh idle period',()=>{
 const s=setup();s.advance(600000);s.activity();assert.equal(s.document.querySelector('dialog'),null);s.advance(599999);assert.equal(s.signedOut(),0);assert.equal(s.document.querySelector('dialog'),null);s.advance(1);assert.ok(s.document.querySelector('dialog'));
});
test('activity after a suspended tab has expired cannot revive the session',()=>{
 const s=setup(1000000-780000);assert.equal(s.signedOut(),1);s.activity();assert.equal(s.signedOut(),1);
});
test('activity from another portal tab extends this tab’s session',()=>{
 const s=setup();s.advance(600000);s.values.set('985.activity.member',String(s.now()+1000));s.advance(1000);assert.equal(s.document.querySelector('dialog'),null);s.advance(500000);assert.equal(s.signedOut(),0);
});
test('background updates and tab focus do not count as user activity',()=>{
 const s=setup();s.advance(600000);s.window.dispatchEvent(new s.window.Event('focus'));s.advance(180000);assert.equal(s.signedOut(),1);
});
