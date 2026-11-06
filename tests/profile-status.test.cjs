const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync('js/portal-985-profiles.js','utf8'),context={P:{}};vm.createContext(context);vm.runInContext(s.slice(s.indexOf('  P.profileStatus ='),s.indexOf('  P.profileStatusBadges =')),context);
const b={uid:'u',firstName:'Test',lastName:'Brother',pledgeName:'Test',chapter:'Kappa'};
const data={classes:[{id:'c',chapter:'Kappa'}],people:[{id:'r',classID:'c',fullName:'Test Brother',pledgeName:'Test',fallen:true,disaffiliated:true}],accountLinks:{}};
test('profile status follows verified roster links for accounts and roster-only profiles',()=>{
 for(const person of [b,{...b,rosterOnly:true,id:'r'}]){const status=context.P.profileStatus(person,{...data,accountLinks:{u:{rosterID:'r'}}});assert.equal(status.fallen,true);assert.equal(status.disaffiliated,true);}
});
test('unlinked profiles require a unique complete identity and never inherit another chapter status',()=>{
 assert.equal(context.P.profileStatus(b,data).fallen,true);
 assert.equal(context.P.profileStatus({...b,chapter:'Alpha'},data).fallen,false);
 assert.equal(context.P.profileStatus(b,{...data,people:[...data.people,{...data.people[0],id:'second'}]}).fallen,false);
 assert.equal(context.P.profileStatus({...b,pledgeName:''},data).fallen,false);
});
