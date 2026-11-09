const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const P={ready:()=>{}},context={P985:P,Date,document:{addEventListener:()=>{}}};for(const f of ['js/portal-985-roster.js','js/portal-newly-crossed.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),context);return P;}
test('new crossing class follows chapter sequence and handles Greek rollovers',()=>{const P=setup();for(const [from,to]of [['Alpha','Beta'],['Alpha Theta','Alpha Iota'],['Beta Omega','Gamma Alpha'],['Omega','Alpha Alpha']])assert.equal(P.nextCrossingClass('Kappa',{classes:[{chapter:'Kappa',pledgeClass:from}],tree:[]}),to);assert.equal(P.nextCrossingClass('Kappa',{classes:[{chapter:'Beta',pledgeClass:'Beta Omega'}],tree:[]}), 'Alpha');});
test('Summer 2026 includes Kappa Alpha using the same family-tree fallback as the master roster',()=>{
 const P=setup(),data={classes:[{id:'k',chapter:'Kappa',pledgeClass:'Alpha'},{id:'b',chapter:'Beta',pledgeClass:'Beta Iota'}],tree:[{chapter:'Kappa',pledgeClass:'Alpha Class',term:'Summer',year:2026}]};
 assert.equal(P.classesForCrossing('Kappa',{term:'Summer',year:2026},data)[0].id,'k');assert.equal(P.classesForCrossing('Kappa',{term:'Fall',year:2026},data).length,0);assert.equal(P.classesForCrossing('Beta',{term:'Summer',year:2026},data).length,0);
});
test('semester filter honors saved class dates and does not guess conflicting family-tree dates',()=>{
 const P=setup(),data={classes:[{id:'k',chapter:'Kappa',pledgeClass:'Alpha'}],tree:[{chapter:'Kappa',pledgeClass:'Alpha',term:'Summer',year:2026},{chapter:'Kappa',pledgeClass:'Alpha',term:'Fall',year:2026}]};
 assert.equal(P.classesForCrossing('Kappa',{term:'Summer',year:2026},data).length,0);
 Object.assign(data.classes[0],{semesterCrossed:'Summer',yearCrossed:2026});assert.equal(P.classesForCrossing('Kappa',{term:'Summer',year:2026},data).length,1);assert.equal(P.classesForCrossing('Kappa',{term:'Fall',year:2026},data).length,0);
});
