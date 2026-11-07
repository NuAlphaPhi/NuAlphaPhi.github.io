(function(){
'use strict';const P=P985;let slots={},portraits={};
const seats=[['national-president','National President'],['national-vicePresident','National Vice President'],['national-secretary','National Secretary'],['national-treasurer','National Treasurer'],['national-brandDirector','National Brand Director'],['national-eventCoordinator','National Event Coordinator'],['national-brotherhood','National Brotherhood']];
function render(){const root=document.getElementById('panel-leadership');if(!P.uid||!root)return;root.replaceChildren(P.el('h1','','Leadership'));
 const group=(title,entries)=>{const section=P.el('section','p-leadership-section'),grid=P.el('div','p-leadership-grid');section.append(P.el('h2','',title),grid);entries.forEach(([id,label])=>{const card=P.el('article','p-card p-leadership-seat');card.append(P.el('h3','',label));const uid=slots[id];if(uid){
 const roster=uid.startsWith('roster_')?P.rosterData?.people.find(p=>p.id===uid.slice(7)):null;
 const person=roster||P.person(uid)||{},portrait=portraits[uid];
 const identity=P.button('',()=>P.profile(uid),'p-leadership-person');
 const avatar=P.avatar({...person,...(portrait?{avatarPath:portrait,photoDataUrl:''}:{})});
 const names=P.el('span','p-leadership-person__names');
 names.append(P.el('strong','',person.pledgeName||P.name(person)));
 if(person.fullName)names.append(P.el('small','p-muted',person.fullName));
 identity.append(avatar,names);card.append(identity);
 if(P.me?.isAdmin){
 const edit=P.button('',()=>editPortrait(uid),'p-leadership-photo-button');
 edit.title=portrait?'Change leadership portrait':'Add leadership portrait';
 edit.setAttribute('aria-label',edit.title);
 edit.append(P.icon('photo'));card.append(edit);
 }
 }else card.append(P.el('p','p-muted','Not assigned'));grid.append(card);});if(!entries.length)grid.append(P.el('p','p-muted','No national interns assigned.'));root.append(section);};
 group('National Board',seats);group('National Interns',Object.keys(slots).filter(k=>k.startsWith('intern-')&&slots[k]).map(k=>[k,'National Intern']));group('Chapter Presidents',P.chapters.map(c=>['president-'+c,c+' Chapter']));
}
function editPortrait(uid){
 if(!P.me?.isAdmin)return;
 const box=P.el('div','p-leadership-editor'),input=P.el('input'),status=P.el('p','p-muted');
 input.type='file';input.accept='image/*';input.setAttribute('aria-label','Leadership portrait');
 box.append(P.el('p','p-muted','Only used in Leadership. Your regular profile picture stays the same.'),input);
 const save=P.button('Upload portrait',()=>P.run(box,async()=>{
 if(!input.files?.[0])throw Error('Choose a photo first.');
 save.disabled=true;
 try{
 const path=await P.upload(input.files[0],'leadershipPortraits/'+uid+'/'+crypto.randomUUID()+'.jpg',status,true);
 await db.doc('leadershipPortraits/'+uid).set({path,updatedBy:P.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
 dialog.close();
 }finally{save.disabled=false;}
 }),'p-primary');
 box.append(status,save);
 if(portraits[uid])box.append(P.button('Remove portrait',()=>P.run(box,async()=>{await db.doc('leadershipPortraits/'+uid).delete();dialog.close();})));
 const dialog=P.dialog('Leadership portrait',box);
}
P.ready(()=>P.watch(db.collection('leadershipPortraits'),rows=>{portraits=Object.fromEntries((rows||[]).map(r=>[r.id,r.path]));render();},document.getElementById('panel-leadership')));
P.ready(()=>P.watch(db.doc('organization/leadership'),d=>{slots=d?.slots||{};render();},document.getElementById('panel-leadership')));document.addEventListener('p985:roster',render);
})();
