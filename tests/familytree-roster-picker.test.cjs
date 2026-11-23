const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('js/portal-familytree.js','utf8');const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('  function rosterNorm'),src.indexOf('  async function loadRosterPicker')),ctx);
const rows=[{id:'a',classID:'c',fullName:'Andy Yoong',pledgeName:'Mosaic'},{id:'b',classID:'c',fullName:'Aiden Yue',pledgeName:'VIRO'}],classes={c:{chapter:'Kappa'}};
test('only brothers missing from the tree are offered',()=>{assert.equal(ctx.availableRoster(rows,classes,{},[{id:'tree-a',chapter:'Kappa',name:'Andy Yoong'}]).map(r=>r.id).join(','),'b');});
test('explicit links exclude renamed records and stable IDs prevent duplicate imports',()=>{assert.equal(ctx.availableRoster(rows,classes,{a:{treeID:'other'}},[{id:'other'},{id:'roster-b'}]).length,0);});
test('same names in another chapter remain available and missing classes are excluded',()=>{assert.equal(ctx.availableRoster(rows,classes,{},[{chapter:'Alpha',name:'Andy Yoong',pledgeName:'Mosaic'}]).length,2);assert.equal(ctx.availableRoster(rows,{}, {},[]).length,0);});
