const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/portal-familytree.js','utf8');
const helper=source.slice(source.indexOf('  function memberStatus('),source.indexOf("  document.addEventListener('p985:roster'"));
function status(member,data){const context={window:{P985:{rosterData:data}}};vm.createContext(context);vm.runInContext(helper,context);return Array.from(context.memberStatus(member));}
const member={id:'tree',name:'Example Brother',pledgeName:'Example',chapter:'Kappa',pledgeClass:'Alpha'};
const data={classes:[{id:'c',chapter:'Kappa',pledgeClass:'Alpha Class'}],people:[{id:'r',classID:'c',fullName:'Example Brother',pledgeName:'Example',disaffiliated:true,fallen:true}],links:{}};
test('family tree tags use recorded flags and unique complete roster identities',()=>{
 assert.deepEqual(status(member,data),['Delettered','RIP']);
 assert.deepEqual(status(member,{...data,people:[...data.people,{...data.people[0],id:'duplicate'}]}),[]);
 assert.deepEqual(status({...member,name:'Different Brother'},data),[]);
 assert.deepEqual(status({...member,name:'Changed Name'},{...data,links:{r:{treeID:'tree'}}}),['Delettered','RIP']);
 assert.deepEqual(status({...member,fallen:true}),['RIP']);
});
