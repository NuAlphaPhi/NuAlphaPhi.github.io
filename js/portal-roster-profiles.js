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
 const b=P.rosterPerson(uid);root.replaceChildren();root.classList.add('p-feed','p-profile-page');
 if(!b){root.append(P.empty('This roster profile is unavailable.'));return;}
 const c=P.rosterData.classes.find(c=>c.id===b.classID)||{},crossing=P.rosterClassCrossing(c);
 const heading=P.el('header','p-profile-heading'),back=P.button('←',()=>P.go('roster'),'p-profile-back'),title=P.el('div');
 back.setAttribute('aria-label','Back to Master Roster');title.append(P.el('h1','',b.pledgeName||b.fullName),P.el('small','',b.chapter+' Chapter'));heading.append(back,title);
 const banner=P.el('div','p-profile-cover');banner.append(P.el('span','p-profile-cover-label','NU ALPHA PHI · '+b.chapter.toUpperCase()),P.el('strong','',P.chapterSlogan(b.chapter)));
 const intro=P.el('section','p-profile-intro p-roster-profile-intro'),actions=P.el('div','p-roster-profile-actions');
 actions.append(P.el('span','p-roster-account-note','No portal account'));
 if(P.me.isAdmin)actions.append(P.button('Edit Profile',()=>P.editRosterEntry(b)));
 intro.append(actions,P.el('h2','p-profile-realname',b.fullName||b.pledgeName));
 if(b.pledgeName)intro.append(P.el('span','p-profile-handle','@'+b.pledgeName));
 const roles=Object.entries(slots).filter(([,value])=>value===uid).map(([key])=>key==='warden'?'Pledge Warden':key.startsWith('master-')?'Pledge Master':key.startsWith('president-')?'Chapter President':key.startsWith('intern-')?'National Intern':key.startsWith('advisor-')?'Alumni Advisor':key.replace(/^national-/,'National ').replace(/([a-z])([A-Z])/g,'$1 $2'));
 if(/^alpha(?: class)?$/i.test(b.pledgeClass))roles.unshift(b.chapter==='Alpha'?'Founding Father':'Founder');
 intro.append(P.profileStatusBadges(b));
 if(roles.length){const titles=P.el('div','p-profile-titles');roles.forEach(role=>titles.append(P.el('span','p-profile-title',role)));intro.append(titles);}
 if(b.bio)intro.append(P.text(b.bio));
 const summary=P.el('div','p-profile-summary');summary.append(P.button(b.chapter+' Chapter',()=>P.chapter(b.chapter),'p-profile-chapter'));
 if(b.school)summary.append(P.el('span','',b.school));if(crossing.label)summary.append(P.el('span','','Crossed '+crossing.label));intro.append(summary);
 const socials=P.el('div','p-profile-socials');
 for(const [key,label,host] of [['instagram','Instagram','instagram.com'],['facebook','Facebook','facebook.com'],['linkedin','LinkedIn','linkedin.com'],['twitter','X / Twitter','x.com']]){
  const raw=b[key+'ProfileURL'];if(!raw)continue;
  try{const url=new URL(raw);if(url.protocol!=='https:'||![host,'www.'+host,...(key==='twitter'?['twitter.com','www.twitter.com']:[])].includes(url.hostname))continue;
   const link=P.el('a','p-profile-social',label);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';socials.append(link);
  }catch{}
 }
 if(socials.childElementCount)intro.append(socials);
 const tabs=P.el('div','p-profile-tabs'),panel=P.el('div','p-roster-profile-panel');tabs.setAttribute('role','tablist');
 const facts=()=>{const dl=P.el('dl','p-info');for(const [label,value] of [['Chapter',b.chapter],['Class',b.pledgeClass],['Pledge Number',b.pledgeNumber],['Crossed',crossing.label],['Birthday',b.birthday],['Phone',window.napPhone.format(b.phone)],['Email',b.email],['School',b.school],['Major',b.major],['Education',b.educationStatus],['Graduation',b.graduationYear],['Job',b.occupation],['Hometown',b.hometown],['Location',b.location]])if(value){const item=P.el('div');item.append(P.el('dt','',label),P.el('dd','',String(value)));dl.append(item);}return dl;};
 const show=tab=>{panel.replaceChildren();[...tabs.children].forEach(button=>{const active=button.textContent===tab;button.classList.toggle('is-selected',active);button.setAttribute('aria-selected',String(active));});
  if(tab==='About')panel.append(facts());else{const membership=P.el('section','p-card p-membership-card');membership.append(P.el('h2','',b.pledgeClass.replace(/ class$/i,'')+' Class'));const members=P.el('div','p-class-members');P.rosterData.people.filter(r=>r.classID===b.classID).forEach(r=>members.append(P.el('span','',r.pledgeName||r.fullName)));membership.append(members);panel.append(membership);}
  panel.append(P.profileLineageCard(b));
 };
 ['About','Brotherhood'].forEach(tab=>{const button=P.button(tab,()=>show(tab),'p-profile-tab');button.setAttribute('role','tab');tabs.append(button);});
 root.append(heading,banner,intro,tabs,panel);show('About');
};
})();
