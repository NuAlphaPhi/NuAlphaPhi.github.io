(function(){
'use strict';
const P=P985;
let period={term:'Fall',year:new Date().getFullYear()};
const normalize=s=>String(s||'').toLocaleLowerCase().trim();
P.renderNewlyCrossed=async root=>{
 if(!P.me.isAdmin)return;
 const data=P.rosterData;
 if(!data){root.append(P.empty('The roster is still loading. Reopen Newly Crossed in a moment.'));return;}
 root.append(P.el('p','p-muted','View crossed classes, plan class leadership early, and record new crossings. Saving PM plans does not add pledges to the roster or family tree.'));
 const term=P.select('Crossing semester',['Spring','Summer','Fall'],period.term),year=P.field('Crossing year','number',period.year),toolbar=P.row();
 const area=P.el('div');toolbar.append(term.wrap,year.wrap,P.button('Load semester',()=>P.run(root,async()=>{const value=Number(year.input.value);if(!Number.isInteger(value)||value<1994||value>2100)throw Error('Enter a crossing year from 1994 to 2100.');period={term:term.input.value,year:value};root.replaceChildren();P.renderNewlyCrossed(root);})));root.append(toolbar,area);
 let plans={};
 const current={...period},storageKey='985-crossed:'+P.uid+':'+current.year+':'+current.term;
 let draft;try{draft=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{draft={};}draft.chapters=draft.chapters||{};
 function remember(){try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{}}
 function picker(label,records,selected,max,onChange){
 const box=P.el('div','p-class-role-picker'),query=P.field(label,'search'),chips=P.el('div','p-class-role-selected'),results=P.el('div','p-class-role-results');
 query.input.placeholder='Search real or pledge name…';box.append(query.wrap,chips,results);
 function draw(){chips.replaceChildren();results.replaceChildren();selected.forEach(id=>{const person=records.find(r=>r.id===id),row=P.el('div','p-class-role-chip');row.append(P.el('span','',person?.label||'Unavailable record'),P.button('×',()=>{selected.splice(selected.indexOf(id),1);onChange([...selected]);draw();}));chips.append(row);});
 const q=normalize(query.input.value);if(!q)return;const matches=records.filter(r=>!selected.includes(r.id)&&normalize(r.label).includes(q));matches.slice(0,20).forEach(r=>{const b=P.button(r.label,()=>{if(selected.length>=max)return;selected.push(r.id);query.input.value='';onChange([...selected]);draw();});b.disabled=selected.length>=max;results.append(b);});if(!matches.length)results.append(P.empty('No matches.'));}
 query.input.oninput=draw;draw();return box;
 }
 const records=data.people.filter(r=>!r.disaffiliated&&!r.fallen).map(r=>{const c=data.classes.find(c=>c.id===r.classID);return {id:r.id,label:r.pledgeName+' · '+r.fullName+' · '+(c?.chapter||'')+' / '+(c?.pledgeClass||'')};});
 const trees=data.tree.filter(r=>!r.disaffiliated).map(r=>({id:r.id,label:r.pledgeName+' · '+r.name+' · '+r.chapter+' / '+r.pledgeClass}));
 const wardens=P.el('section','p-card');wardens.append(P.el('h3','',current.term+' '+current.year+' · National pledge wardens'),P.el('p','p-muted','These wardens apply to every chapter crossing this semester. Saving updates PW assignments on all existing classes for this crossing semester too.'));area.append(wardens);
 try{
 const saved=await P.call('portalAction',{action:'crossingOverview',...current});if(!root.isConnected)return;
 plans=saved.plans||{};
 let chosen=[...(saved.pledgeWardenIDs||[])];
 wardens.append(picker('Search national pledge warden(s)',records,chosen,20,ids=>{chosen=ids;}));
 const status=P.el('p','p-muted',saved.saved?'Semester wardens saved.':'Select and save the semester’s wardens before adding a class.');
 wardens.append(P.button('Save semester wardens',()=>P.run(wardens,async()=>{const result=await P.call('portalAction',{action:'saveCrossingWardens',...current,pledgeWardenIDs:chosen});status.textContent='Saved for all chapters · '+result.classesUpdated+' existing classes updated.';}),'p-btn primary'),status);
 }catch(e){P.error(wardens,e);}
 const chapters=P.el('div');area.append(chapters);
 P.chapters.forEach(chapter=>{
 const section=P.el('details','p-card'),summary=P.el('summary');
 const crossed=data.classes.filter(c=>c.chapter===chapter&&normalize(c.semesterCrossed)===normalize(current.term)&&Number(c.yearCrossed)===current.year);
 summary.append(P.el('strong','',chapter+' Chapter'),P.el('span','p-muted',crossed.length?' · Crossed: '+crossed.map(c=>c.pledgeClass).join(', '):' · No class recorded for this crossing semester'));
 section.append(summary);chapters.append(section);
 const existing=P.el('div');section.append(existing);
 function showExisting(){
 const live=P.rosterData||data;existing.replaceChildren();
 const classes=live.classes.filter(c=>c.chapter===chapter&&normalize(c.semesterCrossed)===normalize(current.term)&&Number(c.yearCrossed)===current.year);
 for(const c of classes){
 const card=P.el('section','p-card'),members=live.people.filter(r=>r.classID===c.id).map((r,i)=>({...r,_order:i})).sort((a,b)=>(a.sortOrder??a._order)-(b.sortOrder??b._order));
 card.append(P.el('h3','',c.pledgeClass+' Class · '+members.length+' brothers'),P.el('p','p-muted','Crossed '+current.term+' '+current.year));
 for(const [key,label] of [['pledgeMasterIDs','Pledge masters'],['pledgeWardenIDs','Pledge wardens']])card.append(P.el('p','',label+': '+((c[key]||[]).map(id=>{const r=live.people.find(r=>r.id===id);return r?r.pledgeName+' · '+r.fullName:'Unavailable record';}).join('; ')||'Not assigned')));
 members.forEach((r,i)=>{
 const row=P.el('div','p-roster-person'),info=P.el('div');
 info.append(P.button((i+1)+'. '+r.pledgeName+(r.pledgeNumber!==undefined&&r.pledgeNumber!==''?' #'+r.pledgeNumber:''),()=>P.profile('roster_'+r.id),'p-name'),P.el('p','p-muted',r.fullName));
 if(i===0||i===members.length-1)info.append(P.el('small','p-roster-role',i===0?'Captain':'Co-Captain'));
 row.append(info,P.button('Edit brother',()=>P.editRosterEntry(r)));card.append(row);
 });
 if(!members.length)card.append(P.empty('No brothers saved in this class yet.'));
 card.append(P.button('Edit class / PMs',()=>P.editRosterClass(c.id)),P.button('Open master roster',()=>P.openRosterClass(c.id)));existing.append(card);
 }
 }
 showExisting();
 const refresh=()=>{if(!root.isConnected){document.removeEventListener('p985:roster',refresh);return;}showExisting();};document.addEventListener('p985:roster',refresh);

 if(plans[chapter]&&(!draft.chapters[chapter]||(!draft.chapters[chapter].pledgeClass&&!draft.chapters[chapter].members?.length&&!draft.chapters[chapter].pledgeMasterIDs?.length)))draft.chapters[chapter]={...plans[chapter],members:[]};
 const state=draft.chapters[chapter]||(draft.chapters[chapter]={pledgeClass:plans[chapter]?.pledgeClass||'',pledgeMasterIDs:plans[chapter]?.pledgeMasterIDs||[],members:[]});
 const form=P.el('div'),name=P.field('Class name (e.g. Alpha Nu)','text',state.pledgeClass);name.input.maxLength=80;name.input.oninput=()=>{state.pledgeClass=name.input.value;remember();};
 form.append(name.wrap,picker('Class pledge masters (select two)',records,[...state.pledgeMasterIDs],2,ids=>{state.pledgeMasterIDs=ids;remember();}));
 const planStatus=P.el('p','p-muted',plans[chapter]?'Saved PM plan: '+plans[chapter].pledgeClass+' · Not yet marked crossed':'');
 form.append(P.button('Save PM plan (not crossed yet)',()=>P.run(form,async()=>{await P.call('portalAction',{action:'saveCrossingPlan',...current,chapter,pledgeClass:state.pledgeClass,pledgeMasterIDs:state.pledgeMasterIDs});planStatus.textContent='PM plan saved. No pledges added to the roster or tree.';})),planStatus);
 const members=P.el('div');form.append(members);
 function drawMembers(){members.replaceChildren();state.members.forEach((m,i)=>{
 const card=P.el('section','p-card'),head=P.row();head.append(P.el('h4','','Brother '+(i+1)),P.button('Remove',()=>{state.members.splice(i,1);state.members.forEach((r,j)=>r.lineNumber=j+1);remember();drawMembers();}));card.append(head);
 const grid=P.el('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px';
 for(const [key,label,type] of [['firstName','First name','text'],['lastName','Last name','text'],['pledgeName','Pledge name','text'],['pledgeNumber','Pledge number (0–99)','text'],['lineNumber','Number in line','number']]){
 const f=P.field(label,type,m[key]);if(key==='pledgeNumber'){f.input.maxLength=2;f.input.inputMode='numeric';}else if(key==='lineNumber'){f.input.min=1;f.input.max=99;}else f.input.maxLength=100;
 f.input.oninput=()=>{m[key]=type==='number'?Number(f.input.value):f.input.value;remember();};grid.append(f.wrap);}
 card.append(grid,picker('Big brother',trees,m.bigId?[m.bigId]:[],1,ids=>{m.bigId=ids[0]||'';remember();}));members.append(card);
 });}
 form.append(P.el('p','p-muted','Line 1 is Captain; the final position is Co-Captain. Enter consecutive positions with no duplicates. Pledge numbers such as 00 and 01 keep their leading zeros.'));
 form.append(P.button('+ Add brother',()=>{if(state.members.length>=99)return;state.members.push({firstName:'',lastName:'',pledgeName:'',pledgeNumber:'',lineNumber:state.members.length+1,bigId:''});remember();drawMembers();}));
 form.append(P.button('Review crossed class',()=>{
 const payload={action:'addCrossedClass',...current,chapter,pledgeClass:state.pledgeClass,pledgeMasterIDs:[...state.pledgeMasterIDs],members:state.members.map(m=>({...m}))};
 const review=P.el('div');review.append(P.el('p','',chapter+' · '+state.pledgeClass+' Class · Crossed '+current.term+' '+current.year),P.el('p','','PMs: '+state.pledgeMasterIDs.map(id=>records.find(r=>r.id===id)?.label||'Unavailable').join('; ')));
 [...payload.members].sort((a,b)=>a.lineNumber-b.lineNumber).forEach((m,i,a)=>review.append(P.el('p','',m.lineNumber+'. '+m.firstName+' '+m.lastName+' · '+m.pledgeName+' #'+m.pledgeNumber+(i===0?' · Captain':i===a.length-1?' · Co-Captain':'')+' — Big: '+(trees.find(t=>t.id===m.bigId)?.label||'Not selected'))));
 review.append(P.el('p','p-muted','Saving publishes this crossed class to the master roster and family tree together. It does not create login accounts.'));
 const modal=P.dialog('Review before adding',review),save=P.button('Add to roster & family tree',()=>P.run(review,async()=>{save.disabled=true;try{const result=await P.call('portalAction',payload);delete draft.chapters[chapter];remember();modal.close();form.replaceChildren(P.el('p','',result.count+' crossed brothers added to the roster and family tree.' ));summary.textContent=chapter+' Chapter · '+payload.pledgeClass+' · Added';}catch(e){save.disabled=false;throw e;}}),'p-btn primary');review.append(save);
 },'p-btn primary'));
 form.append(P.el('small','p-muted','Unsubmitted class drafts are saved in this browser.'));const intake=P.el('details'),intakeSummary=P.el('summary','',crossed.length?'Plan or add another class':'Plan leadership / add crossed brothers');intake.open=!crossed.length;intake.append(intakeSummary,form);section.append(intake);drawMembers();
 });
};
})();
