(function(){
'use strict';
const P=P985,roles=[['pledgeMasterIDs','Pledge Masters (PMs)',4],['pledgeWardenIDs','Pledge Wardens (PWs)',20]];
const name=id=>{const r=P.rosterData?.people.find(p=>p.id===id);return r?[r.pledgeName,r.fullName].filter(Boolean).join(' · '):'Unavailable roster record';};
P.classRequestForm=function(c,missingOnly=false){
 const box=P.el('section','p-class-assignments'),chosen={},keys=roles.filter(([key])=>!missingOnly||!(c[key]||[]).length);
 box.append(P.el('h3','','Suggest Class PMs / PWs'),P.el('p','p-muted','Suggestions are sent separately for administrator approval. Your class information changes only after approval.'));
 keys.forEach(([key,label,max])=>{
  chosen[key]=[...(c[key]||[])];const section=P.el('div','p-class-role-picker'),chips=P.el('div','p-class-role-selected'),results=P.el('div','p-class-role-results'),query=P.field(label,'search');query.input.placeholder='Search the master roster…';
  const draw=()=>{chips.replaceChildren();results.replaceChildren();chosen[key].forEach(id=>{const chip=P.el('div','p-class-role-chip');chip.append(P.el('span','',name(id)),P.button('×',()=>{chosen[key]=chosen[key].filter(v=>v!==id);draw();}));chips.append(chip);});const q=query.input.value.trim().toLocaleLowerCase();if(!q)return;const matches=P.rosterData.people.filter(r=>!chosen[key].includes(r.id)&&name(r.id).toLocaleLowerCase().includes(q));matches.slice(0,20).forEach(r=>{const cls=P.rosterData.classes.find(x=>x.id===r.classID);const btn=P.button(name(r.id)+' · '+(cls?.chapter||''),()=>{chosen[key].push(r.id);query.input.value='';draw();});btn.disabled=chosen[key].length>=max;results.append(btn);});if(!matches.length)results.append(P.el('small','p-muted','No matching brothers.'));};
  query.input.oninput=draw;section.append(query.wrap,chips,results);box.append(section);draw();
 });
 const send=P.button('Submit for Approval',()=>P.run(box,async()=>{
  const changes={};keys.forEach(([key])=>{if(JSON.stringify(chosen[key])!==JSON.stringify(c[key]||[]))changes[key]=chosen[key];});
  if(!Object.keys(changes).length)throw Error('Choose PMs or PWs before submitting.');
  send.disabled=true;try{await db.collection('classLeadershipRequests').add({classID:c.id,requestedBy:P.uid,status:'pending',changes,createdAt:firebase.firestore.FieldValue.serverTimestamp()});box.replaceChildren(P.el('p','','Suggestion submitted. An administrator will review it.'));}catch(e){send.disabled=false;throw e;}
 }),'p-btn p-btn--primary');box.append(send);return box;
};
P.suggestClassLeadership=c=>P.dialog(c.chapter+' · '+c.pledgeClass+' Class',P.classRequestForm(c));
P.renderClassRequests=async root=>{
 const list=P.el('div');root.append(list);list.append(P.empty('Loading suggestions…'));
 try{const snap=await db.collection('classLeadershipRequests').where('status','==','pending').get();list.replaceChildren();if(snap.empty)list.append(P.empty('No class leadership suggestions awaiting review.'));
 snap.docs.forEach(doc=>{const r=doc.data(),c=P.rosterData?.classes.find(c=>c.id===r.classID),card=P.el('section','p-card');card.append(P.el('h3','',c?c.chapter+' · '+c.pledgeClass+' Class':'Class unavailable'),P.el('p','p-muted','Suggested by '+(P.person(r.requestedBy)?.pledgeName||'a brother')));
 roles.forEach(([key,label])=>{if(!(key in r.changes))return;card.append(P.el('h4','',label),P.el('p','','Current: '+((c?.[key]||[]).map(name).join(', ')||'None')),P.el('p','','Proposed: '+(r.changes[key].map(name).join(', ')||'None')));});
 const decide=approve=>{const content=P.el('div');content.append(P.el('p','',approve?'Apply the proposed assignments shown in this review?':'Reject this suggestion without changing the class?'));const modal=P.dialog(approve?'Approve Class Leadership':'Reject Suggestion',content);content.append(P.button('Confirm '+(approve?'Approval':'Rejection'),()=>P.run(content,async()=>{
 await db.runTransaction(async tx=>{const fresh=await tx.get(doc.ref);if(fresh.data()?.status!=='pending')throw Error('This suggestion has already been reviewed.');const ref=db.collection('masterRosterClasses').doc(r.classID);const current=await tx.get(ref);if(approve){if(!current.exists)throw Error('The class no longer exists.');for(const key of Object.keys(r.changes)){if(JSON.stringify(current.data()[key]||[])!==JSON.stringify(c?.[key]||[]))throw Error('Class assignments changed. Close this review and reload suggestions before approving.');}tx.update(ref,r.changes);}tx.update(doc.ref,{status:approve?'approved':'rejected',reviewedBy:P.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp()});});modal.close();card.remove();if(!list.children.length)list.append(P.empty('No suggestions awaiting review.'));
 }),'p-btn p-btn--primary'));};
 card.append(P.button('Approve',()=>decide(true)),P.button('Reject',()=>decide(false)));list.append(card);
 });}catch(e){list.replaceChildren(P.empty('Could not load suggestions. '+e.message));}
};
})();
