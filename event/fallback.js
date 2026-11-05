// GitHub Pages routes individual event invitations through this 404 document.
(async function(){
 if(!/^\/event\/[A-Za-z0-9_-]{1,128}\/?$/.test(location.pathname))return;
 document.title='Brotherhood event · Nu Alpha Phi';
 try{
  for(const src of ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js','/js/firebase-config.js','/event/event.js?v=community1']){
   await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.body.append(script);});
  }
 }catch(_){document.getElementById('loading').textContent='Could not load this invitation. Please refresh to try again.';}
})();
