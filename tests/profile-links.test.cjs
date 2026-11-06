const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function fixture(path,uid='viewer'){
 const {document,window}=parseHTML('<main id="root"></main>');let events={},opened=[];
 document.addEventListener=(name,fn)=>events[name]=fn;
 const P={uid,me:{pledgeName:'Viewer'},brothers:[{uid:'viro',pledgeName:'VIRO',firstName:'Aiden',lastName:'Yue',chapter:'Kappa'}],rosterData:{people:[],accountLinks:{}},ready(){},root:()=>document.getElementById('root'),profile:(...args)=>opened.push(args),el:(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls||'';el.textContent=text||'';return el;},button:(text,fn)=>{const el=document.createElement('button');el.textContent=text;el.onclick=fn;return el;},go(){}};
 vm.runInNewContext(fs.readFileSync('js/portal-profile-links.js','utf8'),{P985:P,document,window:{napCurrentTab:'profile'},location:{pathname:path}});
 return {P,events,opened,document};
}
test('pledge link normalization handles symbols accents and punctuation',()=>{const {P}=fixture('/');for(const [name,slug] of [['₩ARLORD','warlord'],['SØUTHPÅW','southpaw'],['₡RØWN','crown'],['A$AP','asap'],['T¥GA','tyga'],['A.S.C.E.N.D','ascend']])assert.equal(P.profileSlug(name),slug);});
test('links resolve only after sign-in and collisions require a choice',()=>{
 const f=fixture('/portal-home/profile/VIRO');f.events['p985:people']();assert.equal(f.opened[0][0],'viro');
 const unauth=fixture('/portal-home/profile/viro',null);unauth.events['p985:people']();assert.equal(unauth.opened.length,0);
 const dup=fixture('/portal-home/profile/viro');dup.P.brothers.push({uid:'other',pledgeName:'VIRØ',chapter:'Alpha'});dup.events['p985:people']();assert.equal(dup.opened.length,0);assert.match(dup.document.body.textContent||dup.document.toString(),/Choose a brother/);
});
