const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/portal-familytree.js','utf8');
const helper=source.slice(source.indexOf('  function memberRoster('),source.indexOf("  document.addEventListener('p985:roster'"));
const target=source.slice(source.indexOf('  function memberProfileTarget('),source.indexOf('  function viewPersonProfile('));
const member={id:'tree',name:'Ron Ye',pledgeName:'ZICO',chapter:'Iota',pledgeClass:'Upsilon'};
const data={classes:[{id:'c',chapter:'Iota',pledgeClass:'Upsilon'}],people:[{id:'r',classID:'c',fullName:'Ron Ye',pledgeName:'ZICO'}],links:{r:{treeID:'tree'}},accountLinks:{}};
function resolve(data,brothers=[]){const ctx={window:{P985:{rosterData:data,brothers}}};vm.createContext(ctx);vm.runInContext(helper+target,ctx);return ctx.memberProfileTarget(member);}
test('tree profile navigation prefers verified account and supports roster-only brothers',()=>{
 assert.equal(resolve(data),'roster_r');
 assert.equal(resolve({...data,accountLinks:{account:{rosterID:'r'}}}),'account');
 assert.equal(resolve(data,[{uid:'account',firstName:'Ron',lastName:'Ye',pledgeName:'ZICO',chapter:'Iota'}]),'account');
});
test('tree profile navigation does not guess from a shared pledge name',()=>{
 assert.equal(resolve({...data,links:{},people:[]},[{uid:'other',firstName:'Different',lastName:'Brother',pledgeName:'ZICO',chapter:'Iota'}]),null);
});
