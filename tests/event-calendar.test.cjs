const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/portal-985-experience.js','utf8');
const P={date:v=>v?.toDate?v.toDate():new Date(v)},context={P,URLSearchParams,Date,encodeURIComponent};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  P.googleCalendarURL='),source.indexOf('  P.eventAction=')),context);
test('calendar link carries exact event instants, timezone, and encoded content',()=>{
 const e={id:'abc',title:'Football & Food',description:'Bring snacks\nMeet bros',start:{toDate:()=>new Date('2026-11-28T15:00:00Z')},end:{toDate:()=>new Date('2026-11-28T19:00:00Z')},timeZone:'America/New_York',location:'Boston, MA'};
 const u=new URL(P.googleCalendarURL(e));assert.equal(u.origin,'https://calendar.google.com');assert.equal(u.searchParams.get('action'),'TEMPLATE');assert.equal(u.searchParams.get('dates'),'20261128T150000Z/20261128T190000Z');assert.equal(u.searchParams.get('text'),e.title);assert.equal(u.searchParams.get('location'),e.location);assert.equal(u.searchParams.get('ctz'),e.timeZone);assert.ok(u.searchParams.get('details').includes(e.description));
});
test('optional end uses one hour and undisclosed location remains TBD',()=>{const u=new URL(P.googleCalendarURL({id:'e',title:'Event',start:'2026-11-28T15:00:00Z',locationTBD:true,location:'Hidden'}));assert.equal(u.searchParams.get('dates'),'20261128T150000Z/20261128T160000Z');assert.equal(u.searchParams.get('location'),'Location to be announced');});
