(function(){
'use strict';const P=P985;let slots={},portraits={},terms=[];
const seats=[['national-president','National President'],['national-vicePresident','National Vice President'],['national-secretary','National Secretary'],['national-treasurer','National Treasurer'],['national-brandDirector','National Brand Director'],['national-eventCoordinator','National Event Coordinator'],['national-brotherhood','National Brotherhood']];
let boardView='current',boardYear='';
function render(){
 const root=document.getElementById('panel-leadership');if(!P.uid||!root)return;
 const header=P.el('div','p-leadership-header');header.append(P.el('h1','','Leadership'));
 if(P.me?.isAdmin){const add=P.button('Add leadership term',()=>editTerm(),'p-btn p-leadership-add');add.prepend(P.icon('plus'));header.append(add);}
 const tabs=P.el('div','p-leadership-tabs');tabs.setAttribute('role','tablist');
 [['current','Current Leadership'],['past','Past Boards']].forEach(([id,label])=>{const tab=P.button(label,()=>{boardView=id;render();},'p-leadership-tab');tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(boardView===id));tabs.append(tab);});
 root.replaceChildren(header,tabs);
 const past=terms.filter(t=>t.endDate&&(seats.some(s=>s[0]===t.slot)||t.slot.startsWith('intern-')||t.slot.startsWith('president-')));
 let visible=[];
 if(boardView==='past'){
 const years=new Set();past.forEach(t=>{const end=Number(String(t.endDate).slice(0,4)),start=Number(String(t.startDate||t.endDate).slice(0,4));if(start>=1900&&end<=9999)for(let y=start;y<Math.max(start+1,end);y++)years.add(String(y));});
 const ordered=[...years].sort((a,b)=>Number(b)-Number(a));if(!ordered.includes(boardYear))boardYear=ordered[0]||'';
 const filter=P.el('div','p-leadership-years');filter.setAttribute('aria-label','Board year');ordered.forEach(y=>{const btn=P.button(y+'–'+(Number(y)+1),()=>{boardYear=y;render();},'p-leadership-year');btn.setAttribute('aria-pressed',String(y===boardYear));filter.append(btn);});root.append(filter);
 visible=past.filter(t=>{const start=Number(String(t.startDate||t.endDate).slice(0,4)),end=Number(String(t.endDate).slice(0,4));return Number(boardYear)>=start&&Number(boardYear)<Math.max(start+1,end);});
 if(!visible.length){root.append(P.el('p','p-leadership-empty','No past leadership boards recorded yet.'));return;}
 }
 const cardFor=(id,label,uid,term)=>{
 const card=P.el('article','p-card p-leadership-seat'),top=P.el('div','p-leadership-seat__top');top.append(P.el('h3','',label));card.append(top);
 if(!uid){card.append(P.el('p','p-muted','Not assigned'));return card;}
 const person=personFor(uid),portrait=portraits[uid],identity=P.button('',()=>P.profile(uid),'p-leadership-person'),names=P.el('span','p-leadership-person__names');
 names.append(P.el('strong','',person.pledgeName||P.name(person)));if(fullName(person))names.append(P.el('small','p-muted',fullName(person)));
 identity.append(P.avatar({...person,...(portrait?{avatarPath:portrait,photoDataUrl:''}:{})}),names);card.append(identity);
 card.append(P.el('small','p-leadership-dates',term?.startDate?String(term.startDate).slice(0,4)+' — '+(term.endDate?String(term.endDate).slice(0,4):'Present'):'Current'));
 if(P.me?.isAdmin){const controls=P.el('div','p-leadership-controls');const edit=P.button('',()=>editTerm(term||{slot:id,uid}),'p-leadership-term-edit');edit.title='Edit leadership term';edit.setAttribute('aria-label',edit.title);edit.append(P.icon('edit'));controls.append(edit);
 const photo=P.button('',()=>editPortrait(uid),'p-leadership-photo-button');photo.title=portrait?'Change leadership portrait':'Add leadership portrait';photo.setAttribute('aria-label',photo.title);photo.append(P.icon('photo'));controls.append(photo);top.append(controls);}
 return card;};
 const group=(title,entries)=>{if(!entries.length)return;const section=P.el('section','p-leadership-section'),grid=P.el('div','p-leadership-grid');section.append(P.el('h2','',title),grid);entries.forEach(([id,label,uid,term])=>grid.append(cardFor(id,label,uid,term)));root.append(section);};
 if(boardView==='current'){const entries=list=>list.map(([id,label])=>[id,label,slots[id],terms.find(t=>t.slot===id&&t.uid===slots[id]&&!t.endDate)]);group('National Board',entries(seats));group('National Interns',entries(Object.keys(slots).filter(k=>k.startsWith('intern-')&&slots[k]).map(k=>[k,'National Intern'])));group('Chapter Presidents',entries(P.chapters.map(c=>['president-'+c,c+' Chapter'])));}
 else{const entries=items=>items.map(t=>[t.slot,roleName(t.slot),t.uid,t]);group('National Board',entries(visible.filter(t=>seats.some(s=>s[0]===t.slot)).sort((a,b)=>seats.findIndex(s=>s[0]===a.slot)-seats.findIndex(s=>s[0]===b.slot))));group('National Interns',entries(visible.filter(t=>t.slot.startsWith('intern-'))));group('Chapter Presidents',entries(visible.filter(t=>t.slot.startsWith('president-'))));}
}
function personFor(uid){return uid.startsWith('roster_')?P.rosterPerson?.(uid)||P.rosterData?.people.find(p=>p.id===uid.slice(7))||{}:P.person(uid)||{};}
function fullName(p){return [p.firstName,p.middleName,p.lastName].filter(Boolean).join(' ')||p.fullName||'';}
function roleName(slot){return seats.find(s=>s[0]===slot)?.[1]||(slot.startsWith('intern-')?'National Intern':slot.startsWith('president-')?slot.slice(10)+' Chapter President':slot);}
function editTerm(term){
 if(!P.me?.isAdmin)return;
 const box=P.el('form','p-leadership-editor'),role=P.el('select'),search=P.el('input'),results=P.el('div','p-term-results');
 let selected=term?.uid||'';
 [...seats,['intern','National Intern'],...P.chapters.map(c=>['president-'+c,c+' Chapter President'])].forEach(([id,name])=>{const o=P.el('option','',name);o.value=id;role.append(o);});
 role.value=term?.slot?.startsWith('intern-')?'intern':term?.slot||seats[0][0];role.disabled=!!term;
 const field=(label,input)=>{const wrap=P.el('label','p-term-field');wrap.append(P.el('span','',label),input);return wrap;};
 search.type='search';search.placeholder='Search name or pledge name';search.value=term?(personFor(selected).pledgeName||fullName(personFor(selected))):'';search.disabled=!!term;
 search.oninput=()=>{selected='';results.replaceChildren();const query=search.value.toLowerCase().trim();if(!query)return;[...(P.roleCandidates?.()||P.brothers),...(P.rosterData?.people||[]).filter(p=>p.disaffiliated||p.fallen).map(p=>P.rosterPerson(p.id))].filter(p=>(P.name(p)+' '+fullName(p)+' '+p.chapter).toLowerCase().includes(query)).slice(0,12).forEach(p=>results.append(P.button(P.name(p)+' · '+fullName(p)+' · '+p.chapter,()=>{selected=p.uid;search.value=P.name(p)+' · '+fullName(p);results.replaceChildren();},'p-name')));};
 const start=P.el('input'),end=P.el('input');start.type=end.type='number';[start,end].forEach(input=>{input.min='1900';input.max='9999';input.step='1';input.placeholder='YYYY';});start.required=true;start.value=String(term?.startDate||'').slice(0,4);end.value=String(term?.endDate||'').slice(0,4);
 const dates=P.el('div','p-term-dates');dates.append(field('Start year',start),field('End year',end));
 const save=P.el('button','p-portrait-save','Save term');save.type='submit';
 box.append(field('Role',role),field('Brother',search),results,dates,P.el('small','p-muted','Leave the end year empty for the current leader. Past terms need an end year.'),save);
 const dialog=P.dialog(term?'Edit leadership term':'Add leadership term',box);dialog.classList.add('p-term-dialog');
 box.onsubmit=e=>{e.preventDefault();P.run(box,async()=>{
 if(!selected)throw Error('Select a brother from the results.');
 if(!start.value||end.value&&Number(end.value)<=Number(start.value))throw Error('Choose a start year and an end year at least one year later.');
 const slot=term?.slot||(role.value==='intern'?'intern-'+selected:role.value),current=slots[slot]||'';
 save.disabled=true;
 try{
 if(!end.value&&current!==selected){
 if(current&&!confirm('Replace '+(personFor(current).pledgeName||'the current leader')+'? Their term will end in '+start.value+'.'))return;
 await P.call('manageLeadership',{action:'assign',slot,uid:selected,expectedUid:current,startDate:start.value});
 }else if(end.value&&term&&!term.endDate&&current===selected){
 if(!confirm('End this leadership appointment in '+end.value+'? Role access will be removed and the term saved in history.'))return;
 await P.call('manageLeadership',{action:'assign',slot,uid:'',expectedUid:current,startDate:start.value,endDate:end.value});
 }else await P.call('manageLeadership',{action:'term',slot,uid:selected,startDate:start.value,endDate:end.value,...(term?.id?{termID:term.id}:{})});
 dialog.close();
 }finally{save.disabled=false;}
 });};
}

function editPortrait(uid){
 if(!P.me?.isAdmin)return;
 const box=P.el('div','p-leadership-editor'),input=P.el('input'),status=P.el('p','p-muted');
 input.type='file';input.accept='image/*';input.hidden=true;
 const preview=P.el('div','p-portrait-preview'),canvas=P.el('canvas');
 canvas.width=canvas.height=800;canvas.hidden=true;canvas.tabIndex=0;
 canvas.setAttribute('aria-label','Portrait crop. Drag or use arrow keys to reposition.');
 const placeholder=P.el('div','p-portrait-placeholder');
 placeholder.append(P.icon('photo'),P.el('strong','','Choose a leadership photo'),P.el('small','','JPG, PNG or WebP · Up to 20 MB'));
 preview.append(placeholder,canvas);
 const choose=P.button('Choose photo',()=>input.click(),'p-portrait-choose');
 const controls=P.el('div','p-portrait-controls');controls.hidden=true;
 const zoom=P.el('input');zoom.type='range';zoom.min=1;zoom.max=4;zoom.step=.01;zoom.value=1;zoom.setAttribute('aria-label','Zoom photo');
 let bitmap=null,rotation=0,x=0,y=0,drag=null,revision=0,closed=false;
 function draw(){
 if(!bitmap)return;
 const swapped=rotation%180!==0,w0=swapped?bitmap.height:bitmap.width,h0=swapped?bitmap.width:bitmap.height;
 const scale=Math.max(800/w0,800/h0)*Number(zoom.value),w=w0*scale,h=h0*scale;
 x=Math.max(-(w-800)/2,Math.min((w-800)/2,x));y=Math.max(-(h-800)/2,Math.min((h-800)/2,y));
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,800,800);ctx.save();ctx.fillStyle='#ffffff';ctx.fillRect(0,0,800,800);
 ctx.translate(400+x,400+y);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(bitmap,-bitmap.width*scale/2,-bitmap.height*scale/2,bitmap.width*scale,bitmap.height*scale);ctx.restore();
 }
 function reset(){x=y=rotation=0;zoom.value=1;draw();}
 const rotate=delta=>{rotation=(rotation+delta+360)%360;x=y=0;draw();};
 controls.append(P.el('span','','Zoom'),zoom,P.row(P.button('↶ Rotate left',()=>rotate(-90)),P.button('↷ Rotate right',()=>rotate(90)),P.button('Reset',reset)));
 zoom.oninput=draw;
 canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ox:x,oy:y};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag)return;const scale=800/canvas.getBoundingClientRect().width;x=drag.ox+(e.clientX-drag.x)*scale;y=drag.oy+(e.clientY-drag.y)*scale;draw();};
 canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
 canvas.onkeydown=e=>{const move={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[e.key];if(move){e.preventDefault();x+=move[0];y+=move[1];draw();}};
 input.onchange=()=>P.run(box,async()=>{
 const file=input.files?.[0];if(!file)return;const current=++revision;save.disabled=true;
 if(!file.type.startsWith('image/')||file.size>20*1024*1024){save.disabled=!bitmap;throw Error('Choose an image under 20 MB.');}
 try{const next=await createImageBitmap(file);if(closed||current!==revision){next.close();return;}bitmap?.close();bitmap=next;reset();placeholder.hidden=true;canvas.hidden=false;controls.hidden=false;choose.textContent='Choose another photo';}
 finally{if(current===revision)save.disabled=!bitmap;}
 });
 const save=P.button('Save portrait',()=>P.run(box,async()=>{
 if(!bitmap||!P.me?.isAdmin)return;
 save.disabled=true;input.disabled=true;controls.inert=true;
 try{
 const cropped=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
 if(!cropped)throw Error('Could not prepare this photo. Choose another image.');
 const path=await P.upload(cropped,'leadershipPortraits/'+uid+'/'+crypto.randomUUID()+'.jpg',status);
 await db.doc('leadershipPortraits/'+uid).set({path,updatedBy:P.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
 dialog.close();
 }finally{save.disabled=false;input.disabled=false;controls.inert=false;}
 }),'p-portrait-save');save.disabled=true;
 const footer=P.el('div','p-portrait-footer');
 if(portraits[uid])footer.append(P.button('Remove portrait',()=>P.run(box,async()=>{await db.doc('leadershipPortraits/'+uid).delete();dialog.close();}),'p-portrait-remove'));
 footer.append(save);
 box.append(P.el('p','p-muted','A professional photo for Leadership only.'),preview,choose,input,P.el('small','p-muted','Drag to frame your photo. The circle shows how it will appear.'),controls,status,footer);
 const dialog=P.dialog('Leadership portrait',box);dialog.classList.add('p-portrait-dialog');
 dialog.cleanup=()=>{closed=true;revision++;bitmap?.close();};
}
P.ready(()=>P.watch(db.collection('leadershipTerms'),rows=>{terms=rows||[];render();},document.getElementById('panel-leadership')));
P.ready(()=>P.watch(db.collection('leadershipPortraits'),rows=>{portraits=Object.fromEntries((rows||[]).map(r=>[r.id,r.path]));render();},document.getElementById('panel-leadership')));
P.ready(()=>P.watch(db.doc('organization/leadership'),d=>{slots=d?.slots||{};render();},document.getElementById('panel-leadership')));document.addEventListener('p985:roster',render);
})();
