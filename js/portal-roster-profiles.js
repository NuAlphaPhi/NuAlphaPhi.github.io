(function(){
'use strict';const P=P985,prefix='roster_';let slots={};
P.ready(()=>P.watch(db.doc('organization/leadership'),d=>{slots=d?.slots||{};document.dispatchEvent(new Event('p985:roster'));},P.root('profile')));
P.rosterPerson=id=>{
 const data=P.rosterData;if(!data)return null;
 const r=data.people.find(r=>r.id===id.replace(/^roster_/,''));if(!r)return null;
 const c=data.classes.find(c=>c.id===r.classID)||{};
 return {...r,uid:prefix+r.id,chapter:c.chapter||'',pledgeClass:c.pledgeClass||'',firstName:r.fullName||'',lastName:'',rosterOnly:true};
};
P.roleCandidates=()=>{
 const data=P.rosterData;if(!data)return P.brothers;
 const linked=new Set(Object.values(data.accountLinks||{}).map(l=>l.rosterID));
 return [...P.brothers,...data.people.filter(r=>!linked.has(r.id)).map(r=>P.rosterPerson(r.id)).filter(b=>b&&!b.disaffiliated&&!b.fallen&&!P.brothers.some(a=>a.chapter===b.chapter&&String(a.pledgeName||'').toLowerCase()===String(b.pledgeName||'').toLowerCase()&&[a.firstName,a.middleName,a.lastName].filter(Boolean).join(' ').toLowerCase()===b.fullName.toLowerCase()))];
};
const author=P.author;P.author=(uid,...args)=>{
 if(!String(uid).startsWith(prefix))return author(uid,...args);
 const b=P.rosterPerson(uid);return P.button(b?b.pledgeName+' · '+b.chapter+' · No portal account':'Roster profile',()=>P.profile(uid),'p-name');
};
P.renderRosterProfile=(uid,root)=>{
 const b=P.rosterPerson(uid);root.replaceChildren();root.classList.add('p-profile-page');
 if(!b){root.append(P.empty('This roster profile is unavailable.'));return;}
 const c=P.rosterData.classes.find(c=>c.id===b.classID)||{}, crossing=P.rosterClassCrossing(c);
 const heading=P.el('header','p-profile-heading');heading.append(P.button('← Master Roster',()=>P.go('roster')),P.el('h1','',b.pledgeName));
 const banner=P.el('div','p-profile-cover');banner.append(P.el('span','p-profile-cover-label','NU ALPHA PHI · '+b.chapter.toUpperCase()),P.el('strong','',b.chapter+' Chapter'));
 const intro=P.el('section','p-card');intro.append(P.el('span','p-roster-role','No portal account'),P.el('h2','',b.pledgeName+(b.pledgeNumber?' #'+b.pledgeNumber:'')),P.el('p','p-muted',b.fullName));
 if(P.me.isAdmin)intro.append(P.button('Edit Profile',()=>P.editRosterEntry(b)));
 const info=P.el('section','p-card');info.append(P.el('h3','','About'));
 const roles=Object.entries(slots).filter(([,value])=>value===uid).map(([key])=>key==='warden'?'Pledge Warden':key.startsWith('master-')?'Pledge Master':key.startsWith('president-')?'Chapter President':key.startsWith('intern-')?'National Intern':key.startsWith('advisor-')?'Alumni Advisor':key.replace(/^national-/,'National ').replace(/([a-z])([A-Z])/g,'$1 $2'));
 if(roles.length)info.append(P.el('p','',roles.join(' · ')));
 const treeID=P.rosterData.links?.[b.id]?.treeID,node=P.rosterData.tree?.find(t=>t.id===treeID);
 if(node){const big=P.rosterData.tree.find(t=>t.id===node.bigId),littles=P.rosterData.tree.filter(t=>t.bigId===node.id);if(big)info.append(P.el('p','','Big: '+big.pledgeName+' · '+big.name));if(littles.length)info.append(P.el('p','','Littles: '+littles.map(t=>t.pledgeName).join(', ')));}

 for(const [label,value] of [['Chapter',b.chapter],['Class',b.pledgeClass],['Crossed',crossing.label],['Location',b.location],['Occupation',b.occupation],['Email',b.email],['Phone',b.phone],['Bio',b.bio]])if(value){const row=P.el('div','p-roster-profile-detail');row.append(P.el('strong','',label),P.el('span','',value));info.append(row);}
 if(b.fallen)info.append(P.el('p','','Fallen Brother · May he rest in peace.'));if(b.disaffiliated)info.append(P.el('p','','Disaffiliated'));
 root.append(heading,banner,intro,info);
};
})();
