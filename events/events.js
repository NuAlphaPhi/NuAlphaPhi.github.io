'use strict';
const api='https://us-central1-nualphaphi-6b330.cloudfunctions.net/publicEvent';
const $=id=>document.getElementById(id);let rows=[],tab='upcoming',loading=true;
function text(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
function render(){
 const now=Date.now(),visible=rows.filter(e=>tab==='upcoming'?(e.end??e.start)>=now:(e.end??e.start)<now).sort((a,b)=>tab==='upcoming'?a.start-b.start:b.start-a.start);
 $('upcoming').setAttribute('aria-pressed',String(tab==='upcoming'));$('past').setAttribute('aria-pressed',String(tab==='past'));$('eventGrid').replaceChildren();
 for(const e of visible){const card=document.createElement('a');card.className='event-card';card.href='/event/'+e.id;const cover=document.createElement('img');cover.src=api+'?id='+encodeURIComponent(e.id)+'&image=1';cover.alt=e.title+' cover';cover.loading='lazy';const section=document.createElement('section');section.append(text('p',new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:e.timeZone}).format(new Date(e.start)),'eyebrow'),text('h2',e.title),text('p',e.locationTBD?'Location to be announced':e.location,'muted'),text('p','Hosted by '+e.hostName,'muted'));card.append(cover,section);$('eventGrid').append(card);}
 $('listState').textContent=loading?'Loading events…':visible.length?`${visible.length} ${tab==='upcoming'?'upcoming':'completed'} event${visible.length===1?'':'s'}`:tab==='upcoming'?'New plans are on the way. Check back soon.':'No completed events yet.';
}
async function load(){loading=true;rows=[];$('listError').textContent='';$('retryList').hidden=true;render();let cursor=null;try{do{const r=await fetch(api+'?list=1'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load events.');rows.push(...d.events);cursor=d.next;render();}while(cursor);}catch(e){$('listError').textContent='Some events could not be loaded. '+e.message;$('retryList').hidden=false;}finally{loading=false;render();}}
$('upcoming').onclick=()=>{tab='upcoming';render();};$('past').onclick=()=>{tab='past';render();};$('retryList').onclick=load;load();
