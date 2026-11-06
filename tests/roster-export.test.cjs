const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../js/portal-roster-export'),ExcelJS=require('../vendor/exceljs/exceljs.min');
const sample={generatedAt:'2026-11-06T02:00:00Z',exporter:{firstName:'Test',lastName:'Brother',pledgeName:'VIRO'},classes:[{id:'k',chapter:'Kappa',pledgeClass:'Alpha Class'},{id:'ab',chapter:'Alpha',pledgeClass:'Beta'},{id:'aa',chapter:'Alpha',pledgeClass:'Alpha'}],people:[{id:'3',classID:'k',pledgeName:'Third',fullName:'Test Brother'},{id:'2',classID:'ab',pledgeName:'Second',fullName:'Yuk Chan'},{id:'1',classID:'aa',pledgeName:'=HYPERLINK("bad")',fullName:'Lok Man Kwong'}],tree:[{chapter:'Alpha',pledgeClass:'Alpha',term:'Spring',year:1994},{chapter:'Alpha',pledgeClass:'Beta',term:'Fall',year:1994},{chapter:'Kappa',pledgeClass:'Alpha',term:'Summer',year:2026}],slots:{warden:'w'},contacts:[{id:'w',chapter:'Delta',pledgeClass:'Alpha Xi',pledgeName:'Warden',firstName:'Test',lastName:'Name',phone:'123-456-7890'}],brothers:[]};
test('roster sheets order chapters/classes, preserve full first names, and isolate founders',async()=>{
 const book=E.build(ExcelJS,sample);assert.deepEqual(book.worksheets.map(s=>s.name),['Top Sheet','Roster Check','Founders',...E.CHAPTERS]);
 const roster=book.getWorksheet('Roster Check');assert.equal(roster.getCell('A2').value,'Alpha');assert.equal(roster.getCell('B2').value,'Alpha');assert.equal(roster.getCell('D2').value,'Lok Man');assert.equal(roster.getCell('E2').value,'Kwong');assert.equal(roster.getCell('G2').value,1994);assert.equal(roster.getCell('A4').value,'Kappa');assert.equal(book.getWorksheet('Founders').rowCount,3);
 assert.equal(book.getWorksheet('Top Sheet').getCell('C19').value.result,3);assert.equal(book.getWorksheet('Top Sheet').getCell('K4').value,'123-456-7890');
 const reloaded=new ExcelJS.Workbook();await reloaded.xlsx.load(await book.xlsx.writeBuffer());assert.equal(reloaded.worksheets.length,13);assert.equal(reloaded.getWorksheet('Roster Check').getCell('C2').type,ExcelJS.ValueType.String);assert.equal(reloaded.getWorksheet('Roster Check').getCell('C2').value,'=HYPERLINK("bad")');
});
test('roster export flags conflicts, does not guess dates, and rejects orphaned records',()=>{
 const data={...sample,tree:[...sample.tree,{chapter:'Alpha',pledgeClass:'Alpha',term:'Fall',year:1994}]};const result=E.rows(data);assert.equal(result.rows[0].values[5],'');assert.equal(result.rows[0].values[6],'');assert.ok(result.warnings.some(w=>w.includes('conflicting')));
 assert.throws(()=>E.rows({...sample,people:[{id:'missing',classID:'none'}]}),/no valid chapter/);
});
test('explicitly linked accounts preserve compound surnames',()=>{
 const data={...sample,accountLinks:[{id:'account',rosterID:'1'}],brothers:[{id:'account',firstName:'Lok',middleName:'Man',lastName:'van Kwong'}]};assert.deepEqual(E.rows(data).rows[0].values.slice(3,5),['Lok Man','van Kwong']);
});
test('saved member positions control export order within a class',()=>{
 const data={...sample,people:[{id:'a',classID:'aa',pledgeName:'Last',fullName:'Last Brother',sortOrder:1},{id:'b',classID:'aa',pledgeName:'First',fullName:'First Brother',sortOrder:0}]};
 assert.deepEqual(E.rows(data).rows.map(r=>r.values[2]),['First','Last']);
});
