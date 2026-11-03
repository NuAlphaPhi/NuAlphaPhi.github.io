'use strict';
const $=id=>document.getElementById(id);
const match=location.pathname.match(/^\/event\/([A-Za-z0-9_-]{1,128})\/?$/);
const id=match?.[1]||new URLSearchParams(location.search).get('id');
const valid=typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const api='https://us-central1-nualphaphi-6b330.cloudfunctions.net/';
let event,member=false,authEpoch=0,loadedUser=null;
const notice=s=>{$('notice').textContent=s;};
async function call(action,payload={}){
 const user=firebase.auth().currentUser;if(!user)throw Error('Sign in with your brother account first.');
 const token=await user.getIdToken();
 const response=await fetch(api+'eventAction',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({data:{action,eventID:id,requestID:crypto.randomUUID(),...payload}}),signal:AbortSignal.timeout(30000)});
 const body=await response.json();if(body.error)throw Error(body.error.message||'Could not update your RSVP.');if(!response.ok)throw Error('Could not connect. Try again.');return body.result;
}
function fact(label,value){const row=document.createElement('div');row.className='fact';const small=document.createElement('small');small.textContent=label;const text=document.createElement('div');text.textContent=value;row.append(small,text);$('facts').append(row);}
function date(value){return new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:event.timeZone}).format(new Date(value));}
async function load(){
 $('loading').hidden=false;$('unavailable').hidden=true;$('event').hidden=true;
 try{
  if(!valid)throw Error('Ask the host for a valid event link.');
  const response=await fetch(api+'publicEvent?id='+encodeURIComponent(id),{signal:AbortSignal.timeout(20000)});const body=await response.json();if(!response.ok)throw Error(body.error||'Could not load event.');event=body;
  document.title=event.title+' · 985';$('title').textContent=event.title;$('host').textContent='Hosted by '+event.hostName;$('description').textContent=event.description;$('cover').src=api+'publicEvent?id='+encodeURIComponent(id)+'&image=1';$('cover').onerror=()=>{$('cover').removeAttribute('src');$('cover').alt='Event cover unavailable';};
  $('facts').replaceChildren();fact('When',date(event.start));if(event.end)fact('Ends',date(event.end));fact('Where',event.locationTBD?'Location to be announced':event.location);fact('RSVP by',date(event.deadline));fact('Capacity',event.capacity==null?'No capacity limit':`${event.reservedSeats} of ${event.capacity} places reserved · guests count toward capacity`);fact('Guests',event.plusOnes?(event.plusOneLimit==null?'Plus-ones welcome':`Up to ${event.plusOneLimit} plus-ones per brother`):'Brothers only · no plus-ones');
  $('open').href='nap985://event/'+id;$('event').hidden=false;await account(firebase.auth().currentUser);
 }catch(e){$('loadError').textContent=e.message;$('unavailable').hidden=false;}finally{$('loading').hidden=true;}
}
function guest(g={}){const row=document.createElement('div');row.className='guest';for(const [key,title,type] of [['name','Full name','text'],['phone','Phone number','tel']]){const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.dataset.field=key;input.type=type;input.required=true;input.maxLength=key==='name'?120:40;input.value=g[key]||'';label.append(input);row.append(label);}const remove=document.createElement('button');remove.type='button';remove.className='text';remove.textContent='Remove guest';remove.onclick=()=>{row.remove();guestVisibility();};row.append(remove);$('guests').append(row);guestVisibility();}
function guestVisibility(){const going=document.querySelector('[name=status]:checked')?.value==='going';$('guestSection').hidden=!event?.plusOnes||!going;$('guests').querySelectorAll('input').forEach(i=>i.disabled=$('guestSection').hidden);$('addGuest').disabled=event?.plusOneLimit!=null&&$('guests').children.length>=event.plusOneLimit;}
async function account(user){
 const epoch=++authEpoch;member=false;loadedUser=null;$('response').hidden=true;$('guests').replaceChildren();$('login').hidden=!!user;$('logout').hidden=!user;notice('');
 if(!event)return;
 if(!user){$('accountState').textContent='Anyone can view this invitation. Sign in with your approved brother account to RSVP.';return;}
 $('accountState').textContent='Checking your brother account…';
 try{const own=await call('attendance');if(epoch!==authEpoch)return;member=true;loadedUser=user.uid;$('accountState').textContent='Signed in as '+(user.email||'a brother');$('response').hidden=false;document.querySelector(`[name=status][value="${['going','maybe','busy'].includes(own.status)?own.status:'going'}"]`).checked=true;for(const g of own.guests||[])guest(g);guestVisibility();if(own.status)notice('Your RSVP: '+own.status+(own.status==='waitlist'?' — we’ll notify you when your party has a spot.':'.'));if(event.start<=Date.now()){$('response').hidden=true;notice('This event has already started.');}else if(event.deadline<Date.now())notice('The RSVP deadline has passed. You may still cancel by choosing Busy.');}
 catch(e){if(epoch!==authEpoch)return;$('accountState').textContent='An approved brother account is required to RSVP.';notice(e.message);}
}
$('login').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;notice('Signing in…');try{await firebase.auth().signInWithEmailAndPassword($('email').value.trim(),$('password').value);$('password').value='';}catch{notice('Couldn’t sign in. Check your email and password, then try again.');}finally{b.disabled=false;}};
$('reset').onclick=async()=>{const email=$('email').value.trim();if(!email)return notice('Enter your email address first.');try{await firebase.auth().sendPasswordResetEmail(email);notice('If this email has an account, check its inbox for a reset link.');}catch{notice('Could not request a reset. Check the email address and try again.');}};
$('logout').onclick=()=>firebase.auth().signOut();
$('response').onsubmit=async e=>{e.preventDefault();if(!member||firebase.auth().currentUser?.uid!==loadedUser)return notice('Sign in with an approved brother account.');$('save').disabled=true;const status=document.querySelector('[name=status]:checked').value;const guests=status==='going'&&event.plusOnes?[...$('guests').children].map(row=>({name:row.querySelector('[data-field=name]').value.trim(),phone:row.querySelector('[data-field=phone]').value.trim()})):[];try{const result=await call('rsvp',{status,guests});notice(result.status==='waitlist'?'Your party is on the waitlist. We’ll notify you when enough places open.':'RSVP saved: '+result.status+'.');}catch(e){notice(e.message);}finally{$('save').disabled=false;}};
$('addGuest').onclick=()=>guest();document.querySelectorAll('[name=status]').forEach(i=>i.onchange=guestVisibility);
$('share').onclick=async()=>{const url='https://nualphaphi.com/event/'+id;try{if(navigator.share)await navigator.share({title:event.title,url});else{await navigator.clipboard.writeText(url);notice('Event link copied.');}}catch(e){if(e.name!=='AbortError')notice('Copy this link: '+url);}};
$('retry').onclick=load;firebase.auth().onAuthStateChanged(account);load();
