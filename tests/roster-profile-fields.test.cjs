const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('js/portal-985-profiles.js','utf8');
const ctx={P:{rosterClassCrossing:()=>({label:'Spring 2001'})}};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('  P.rosterProfile ='),src.indexOf('  P.profileStatus =')),ctx);
const b={uid:'u',firstName:'Test',lastName:'Brother',pledgeName:'Test',chapter:'Wrong',pledgeClass:'Wrong',crossingTerm:'Fall',crossingYear:'2099'};
const data={accountLinks:{u:{rosterID:'r'}},people:[{id:'r',classID:'c'}],classes:[{id:'c',chapter:'Alpha',pledgeClass:'Beta',semesterCrossed:'Summer',yearCrossed:2000}],tree:[]};
test('linked roster overrides stale profile membership and crossing aliases',()=>{const out=ctx.P.rosterProfile(b,data);assert.equal(out.chapter,'Alpha');assert.equal(out.pledgeClass,'Beta');assert.equal(out.crossingTerm,'Summer');assert.equal(out.yearCrossed,'2000');});
test('unlinked profiles do not invent roster details',()=>{const out=ctx.P.rosterProfile(b,{...data,accountLinks:{}});assert.equal(out.chapter,'');assert.equal(out.crossingYear,'');assert.equal(out.rosterLinked,false);});
