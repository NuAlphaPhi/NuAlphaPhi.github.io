const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/portal-985-roster.js','utf8');
function editor(c){
 const fields={},buttons={},writes=[];const element=()=>({append(){},replaceChildren(){},setAttribute(){}});
 const P={el:element,me:{isAdmin:true},rosterClassMembers:()=>[],chapters:['Alpha'],
 field:(label,type,value='')=>(fields[label]={wrap:element(),input:{value:String(value)}}),
 select:(label,choices,value='')=>(fields[label]={wrap:element(),input:{value}}),
 button:(label,action)=>(buttons[label]=action,element()),run:(_,fn)=>fn(),dialog:()=>({close(){}})};
 const db={collection:()=>({doc:id=>id}),batch:()=>({set:(id,data)=>writes.push({id,data}),update(){},commit:async()=>{}})};
 const ctx={P,db,people:[],norm:s=>s,crypto};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('  function editClass(c)'),source.indexOf('  P.openRosterClass=')),ctx);
 ctx.editClass(c);return{fields,buttons,writes};
}
test('class editor saves semester and numeric year with existing leadership',async()=>{
 const e=editor({id:'alpha-xi',chapter:'Alpha',pledgeClass:'Alpha Xi',pledgeMasterIDs:['pm1','pm2'],pledgeWardenIDs:['pw']});
 e.fields['Crossing semester'].input.value='Fall';e.fields['Crossing year'].input.value='2026';await e.buttons['Save class']();
 assert.equal(e.writes[0].data.semesterCrossed,'Fall');assert.equal(e.writes[0].data.yearCrossed,2026);assert.equal(e.writes[0].data.pledgeMasterIDs.length,2);
 const reopened=editor({id:'alpha-xi',...e.writes[0].data});assert.equal(reopened.fields['Crossing semester'].input.value,'Fall');assert.equal(reopened.fields['Crossing year'].input.value,'2026');
});
test('incomplete or invalid crossing dates cannot be saved',async()=>{
 for(const [term,year] of [['Fall',''],['','2026'],['Winter','2026'],['Fall','1900']]){const e=editor({id:'c',chapter:'Alpha',pledgeClass:'Alpha Xi'});e.fields['Crossing semester'].input.value=term;e.fields['Crossing year'].input.value=year;await assert.rejects(e.buttons['Save class']());assert.equal(e.writes.length,0);}
});
