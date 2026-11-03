const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {channels,freshArea}=require('../js/portal-985-policy');
const ids=g=>channels(g).map(r=>r.id);
test('active and alumni chapter circles remain mutually exclusive',()=>{
 const active=ids({chapter:'Kappa',status:'active'}),alumni=ids({chapter:'Kappa',status:'alumni'});
 assert.ok(active.includes('chapter-actives-Kappa'));assert.ok(!active.includes('chapter-alumni-Kappa'));assert.ok(!active.includes('alumni'));
 assert.ok(alumni.includes('chapter-alumni-Kappa'));assert.ok(!alumni.includes('actives'));assert.ok(!alumni.some(x=>x.includes('Alpha')));
 assert.ok(active.includes('chapter-Kappa')&&alumni.includes('chapter-Kappa'));
});
test('interns see leadership but not the nationals-only room',()=>{
 const r=ids({role:'nationalIntern'});assert.ok(r.includes('leadership')&&r.includes('nationals-interns')&&r.includes('alumni-advisors'));assert.ok(!r.includes('nationals'));
});
test('multiple roles and PB eligibility match the native access model',()=>{
 const r=ids({roles:['president','pledgeMaster'],term:'fall',year:'2026'});assert.ok(r.includes('leadership')&&r.includes('pledge-leadership')&&r.includes('pbs-fall-2026'));assert.ok(!r.includes('nationals'));
 assert.ok(!ids({term:'winter',year:'2026'}).some(x=>x.startsWith('pbs-')));
 assert.ok(!ids({isAdmin:true}).includes('nationals'));
});
test('location expiry and coordinate limits',()=>{const now=Date.now(),base={latitudeCell:2118,longitudeCell:-3553,updatedAt:now};assert.ok(freshArea(base,now));assert.ok(!freshArea({...base,updatedAt:now-7*86400000},now));assert.ok(!freshArea({...base,latitudeCell:9999},now));assert.ok(!freshArea({...base,longitudeCell:1.5},now));assert.ok(!freshArea({...base,updatedAt:now+86400000},now));});
test('portal contains all replacement panels and retains requested features',()=>{const html=fs.readFileSync(require('node:path').join(__dirname,'../portal-home.html'),'utf8');for(const panel of ['home','channels','messages','globe','events','announcements','roster','myprofile','admin','forms','directory','family-tree','gallery','birthdays'])assert.ok(html.includes(`data-panel="${panel}"`),panel);for(const obsolete of ['overview','pledges'])assert.ok(!html.includes(`data-tab="${obsolete}"`));const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);assert.ok(!html.includes('adminCodeForm'));});
if(process.env.NAP_SERVER_POLICY){const {channelAllowed}=require(process.env.NAP_SERVER_POLICY);test('portal circle list agrees with the server across all supported grants',()=>{const roles=['','president','nationalBoard','nationalIntern','pledgeWarden','pledgeMaster','alumniAdvisor'];const all=new Set(['general','shitposting','gaming','sports','finance','actives','alumni','leadership','nationals','nationals-interns','pledge-leadership','alumni-advisors','pbs-fall-2026','pbs-winter-2026',...['Alpha','Kappa'].flatMap(c=>['chapter-','chapter-actives-','chapter-alumni-'].map(p=>p+c))]);for(const chapter of ['','Alpha','Kappa'])for(const status of ['','active','alumni'])for(const role of roles){const grant={chapter,status,role,term:'fall',year:'2026'},visible=new Set(ids(grant));for(const room of all)assert.equal(visible.has(room),channelAllowed(room,grant),JSON.stringify({room,grant}));}});}
