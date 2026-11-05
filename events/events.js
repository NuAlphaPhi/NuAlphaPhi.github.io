'use strict';
const api='https://us-central1-nualphaphi-6b330.cloudfunctions.net/publicEvent';
const $=id=>document.getElementById(id);let rows=[],tab='upcoming',loading=true;
function text(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
function render(){
 const now=Date.now(),visible=rows.filter(e=>tab==='upcoming'?(e.end??e.start)>=now:(e.end??e.start)<now).sort((a,b)=>tab==='upcoming'?a.start-b.start:b.start-a.start);
 $('upcoming').setAttribute('aria-pressed',String(tab==='upcoming'));$('past').setAttribute('aria-pressed',String(tab==='past'));$('eventGrid').replaceChildren();
 for(const e of visible){
  const card=document.createElement('a');card.className='event-card';card.href='/event/'+encodeURIComponent(e.id);
  const art=text('div','','event-art');art.append(text('span','ΝΑΦ','event-art-fallback'));
  const cover=document.createElement('img');cover.alt='';cover.loading='lazy';cover.onload=()=>art.querySelector('.event-art-fallback').hidden=true;cover.onerror=()=>cover.remove();cover.src=api+'?id='+encodeURIComponent(e.id)+'&image=1';art.append(cover);
  const section=document.createElement('section'),date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit',timeZone:e.timeZone}).format(new Date(e.start));
  section.append(text('p',date,'event-date'),text('h2',e.title),text('p',e.locationTBD?'Location to be announced':e.location,'muted'));
  const footer=text('div','','event-card-footer');footer.append(text('span','Hosted by '+e.hostName),text('strong','View event ↗'));section.append(footer);card.append(art,section);$('eventGrid').append(card);
 }
 if(!loading&&!visible.length)$('eventGrid').append(text('div',tab==='upcoming'?'Something good is coming. Check back for new plans.':'Past gatherings will appear here.','empty-events'));
 $('listState').textContent=loading?'Loading events…':visible.length?`${visible.length} ${tab==='upcoming'?'upcoming':'completed'} event${visible.length===1?'':'s'}`:tab==='upcoming'?'New plans are on the way. Check back soon.':'No completed events yet.';
}
async function load(){loading=true;rows=[];$('listError').textContent='';$('retryList').hidden=true;render();let cursor=null;try{do{const r=await fetch(api+'?list=1'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load events.');rows.push(...d.events);cursor=d.next;render();}while(cursor);}catch(e){$('listError').textContent='Some events could not be loaded. '+e.message;$('retryList').hidden=false;}finally{loading=false;render();}}
$('upcoming').onclick=()=>{tab='upcoming';render();};$('past').onclick=()=>{tab='past';render();};$('retryList').onclick=load;load();
