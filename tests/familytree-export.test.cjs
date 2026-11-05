const {test}=require('node:test'),assert=require('node:assert/strict');
const exporter=require('../js/portal-familytree-export.js');
const ExcelJS=require('../vendor/exceljs/exceljs.min.js');
const brothers=[
 {id:'kid',pledgeName:'Kid',name:'Kid Name',chapter:'Alpha',year:1990,term:'Fall'},
 {id:'smokey',bigId:'kid',pledgeName:'Smokey',chapter:'Alpha',year:1991},
 {id:'shaolin',bigId:'kid',pledgeName:'Shaolin',chapter:'Alpha',year:1992},
 {id:'evian',bigId:'shaolin',pledgeName:'Evian',chapter:'Beta',year:1993},
 {id:'spade',bigId:'evian',pledgeName:'Spade',chapter:'Gamma',year:1994},
 {id:'forge',bigId:'spade',pledgeName:'Forge',name:'Full Name',chapter:'Kappa',pledgeClass:'Alpha',term:'Spring',year:1995},
 {id:'other',pledgeName:'=HYPERLINK("bad")',chapter:'Delta',year:2000},
];
test('export preserves generations and forks rather than turning siblings into a chain',()=>{
 const {positions:p}=exporter.layout(brothers);assert.equal(p.size,brothers.length);
 assert.equal(p.get('kid').row,p.get('smokey').row);assert.equal(p.get('shaolin').column,p.get('smokey').column);assert.ok(p.get('shaolin').row>p.get('smokey').row);
 for(const [big,little] of [['shaolin','evian'],['evian','spade'],['spade','forge']]){assert.equal(p.get(little).column,p.get(big).column+1);assert.equal(p.get(big).row,p.get(little).row);}
 assert.ok(p.get('other').row>p.get('forge').row);
});
test('XLSX round trip retains every brother, chapter color, cell note and branch connector',async()=>{
 const wb=exporter.build(ExcelJS,brothers,new Date('2026-11-05T12:00:00Z'));
 const data=await wb.xlsx.writeBuffer(),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(data);
 const sheet=loaded.getWorksheet('Family Tree'),{positions:p}=exporter.layout(brothers);
 for(const b of brothers){const pos=p.get(b.id),cell=sheet.getCell(pos.row,pos.column);assert.equal(cell.value,b.pledgeName);assert.equal(cell.fill.fgColor.argb,'FF'+exporter.COLORS[b.chapter]);assert.ok(cell.note);}
 const forge=p.get('forge'),note=sheet.getCell(forge.row,forge.column).note;
 const content=typeof note==='string'?note:note.texts.map(t=>t.text).join('');assert.match(content,/Pledge name: Forge\nReal name: Full Name\nChapter: Kappa\nClass: Alpha\nCrossed: Spring 1995/);
 assert.equal(sheet.getCell(p.get('shaolin').row,2).border.left.style,'medium');assert.equal(sheet.views[0].ySplit,4);
});
test('missing records remain visible with explicit unknown details; cycles fail with a useful message',()=>{
 const orphan={id:'orphan',bigId:'missing',pledgeName:'Orphan'};assert.equal(exporter.layout([orphan]).positions.size,1);assert.match(exporter.note(orphan,true),/Not recorded/);assert.match(exporter.note(orphan,true),/Big’s record is missing/);
 assert.throws(()=>exporter.layout([{id:'a',bigId:'b'},{id:'b',bigId:'a'}]),/circular/);assert.throws(()=>exporter.layout([]),/no brothers/);
});
test('large forests include all brothers without colliding cells',()=>{
 const members=Array.from({length:1500},(_,i)=>({id:String(i),bigId:i?String(Math.floor((i-1)/3)):null,pledgeName:'Brother '+i,chapter:'Alpha'}));
 const p=exporter.layout(members).positions;assert.equal(new Set([...p.values()].map(v=>v.row+':'+v.column)).size,1500);
});
test('download rejects signed-out and non-admin accounts before loading the exporter',async()=>{
 await assert.rejects(()=>exporter.download(brothers),/Only administrators/);
 global.auth={currentUser:{uid:'member'}};
 const requests=[];global.db={doc:path=>({get:async options=>{requests.push({path,options});return {exists:true,data:()=>({isAdmin:false,membershipStatus:'approved'})};}})};
 try {await assert.rejects(()=>exporter.download(brothers),/Only administrators/);assert.deepEqual(requests,[{path:'users/member',options:{source:'server'}}]);}
 finally {delete global.auth;delete global.db;}
});
test('download rechecks admin access after building the workbook',async()=>{
 let reads=0;global.auth={currentUser:{uid:'admin'}};global.window={ExcelJS};
 global.db={doc:()=>({get:async()=>({exists:true,data:()=>({isAdmin:++reads===1,membershipStatus:'approved'})})})};
 try {await assert.rejects(()=>exporter.download(brothers),/Only administrators/);assert.equal(reads,2);}
 finally {delete global.auth;delete global.window;delete global.db;}
});
