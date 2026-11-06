(function(){
'use strict';const P=P985;let slots={};
const seats=[['national-president','National President'],['national-vicePresident','National Vice President'],['national-secretary','National Secretary'],['national-treasurer','National Treasurer'],['national-brandDirector','National Brand Director'],['national-eventCoordinator','National Event Coordinator'],['national-brotherhood','National Brotherhood']];
function render(){const root=document.getElementById('panel-leadership');if(!P.uid||!root)return;root.replaceChildren(P.el('h1','','Leadership'));
 const group=(title,entries)=>{const section=P.el('section','p-leadership-section'),grid=P.el('div','p-leadership-grid');section.append(P.el('h2','',title),grid);entries.forEach(([id,label])=>{const card=P.el('article','p-card p-leadership-seat');card.append(P.el('h3','',label));const uid=slots[id];if(uid){const roster=uid.startsWith('roster_')?P.rosterData?.people.find(p=>p.id===uid.slice(7)):null;if(roster)card.append(P.button(roster.pledgeName+' · '+roster.fullName,()=>P.profile(uid),'p-name'));else card.append(P.author(uid));}else card.append(P.el('p','p-muted','Not assigned'));grid.append(card);});if(!entries.length)grid.append(P.el('p','p-muted','No national interns assigned.'));root.append(section);};
 group('National Board',seats);group('National Interns',Object.keys(slots).filter(k=>k.startsWith('intern-')&&slots[k]).map(k=>[k,'National Intern']));group('Chapter Presidents',P.chapters.map(c=>['president-'+c,c+' Chapter']));
}
P.ready(()=>P.watch(db.doc('organization/leadership'),d=>{slots=d?.slots||{};render();},document.getElementById('panel-leadership')));document.addEventListener('p985:roster',render);
})();
