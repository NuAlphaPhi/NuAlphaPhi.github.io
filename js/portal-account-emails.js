(function () {
  'use strict';
  const P = P985;
  P.renderAccountEmails = function (section) {
    const intro=P.el('p','p-muted','Use your primary email or any verified extra email to sign in to this same account. They all share one password.');
    const list=P.el('div','settings-account-details'),status=P.el('p','p-muted');status.setAttribute('role','status');
    const primary=P.el('form','p-card'),newEmail=P.field('New primary email','email'),current=P.field('Current password','password');
    newEmail.input.required=true;newEmail.input.autocomplete='email';current.input.required=true;current.input.autocomplete='current-password';
    primary.append(P.el('h3','','Change primary email'),P.el('p','p-muted','We’ll send a verification link to your new address. Your primary email changes only after you open that link. Your account, data, and password stay the same.'),newEmail.wrap,current.wrap);
    const change=P.el('button','p-btn primary','Send verification link');change.type='submit';primary.append(change);
    const extra=P.el('form','p-card'),extraEmail=P.field('Extra sign-in email','email'),extraPassword=P.field('Current password','password'),code=P.field('Verification code','text');
    extraEmail.input.required=true;extraEmail.input.autocomplete='email';extraPassword.input.required=true;extraPassword.input.autocomplete='current-password';code.input.inputMode='numeric';code.input.autocomplete='one-time-code';code.input.pattern='[0-9]{6}';code.input.maxLength=6;code.wrap.hidden=true;
    const send=P.el('button','p-btn primary','Send code'),verify=P.el('button','p-btn','Verify email');send.type='submit';verify.type='button';verify.hidden=true;
    const availability=P.el('p','p-muted');
    extra.append(P.el('h3','','Add another sign-in email'),P.el('p','p-muted','Verify that you own the address before it can be used to sign in. You can add up to five extra emails.'),availability,extraEmail.wrap,extraPassword.wrap,code.wrap,P.row(send,verify));
    section.append(intro,list,status,primary,extra);
    let ready=false,busy=false;
    function buttons(disabled){section.querySelectorAll('button').forEach(b=>b.disabled=disabled);if(!disabled&&!ready){send.disabled=true;verify.disabled=true;}}
    function error(e){const messages={'auth/requires-recent-login':'Sign in again, then retry.','auth/wrong-password':'Your current password is incorrect.','auth/invalid-credential':'Your current password is incorrect.','auth/email-already-in-use':'That email is already used by another account.','auth/too-many-requests':'Too many attempts. Please try again later.'};return messages[e.code]||e.message||'Could not update your emails. Please try again.';}
    async function run(fn){if(busy)return;busy=true;buttons(true);status.textContent='Working…';try{await fn();}catch(e){status.textContent=error(e);}finally{busy=false;buttons(false);}}
    async function refresh(){
      await auth.currentUser.reload();
      const result=await P.call('accountEmails',{action:'list'});
      ready=result.verificationAvailable;availability.textContent=ready?'':'Extra-email verification is being set up. You can change your primary email and password now.';
      list.replaceChildren();const row=P.el('div','settings-detail');row.append(P.el('strong','',result.primary),P.el('span','p-muted','Primary email'));list.append(row);
      for(const a of result.aliases){const r=P.el('div','settings-detail'),actions=P.row();r.append(P.el('strong','',a.email),P.el('span','p-muted','Verified'));
        for(const [action,label]of [['primary','Make primary'],['remove','Remove']])actions.append(P.button(label,()=>emailAction(action,a.email)));
        r.append(actions);list.append(r);
      }
      if(!result.aliases.length)list.append(P.el('p','p-muted','No extra sign-in emails yet.'));
      if(P.me.email!==auth.currentUser.email){await P.call('syncAccountEmail',{});P.me.email=auth.currentUser.email;document.dispatchEvent(new Event('p985:people'));}
      const summary=document.getElementById('settingsAccountEmail');if(summary)summary.textContent=auth.currentUser.email;
      buttons(busy);
    }
    function emailAction(action,email){
      const box=P.el('div'),password=P.field('Current password','password');password.input.autocomplete='current-password';password.input.required=true;
      box.append(P.el('p','p-muted',action==='remove'?`Remove ${email} as a sign-in email? Your primary email will still work.`:`Make ${email} your primary email? Your password and account data stay the same. A previously verified primary email stays available as an extra sign-in email.`),password.wrap);
      const feedback=P.el('p','p-muted');feedback.setAttribute('role','status');
      const submit=P.button(action==='remove'?'Remove email':'Make primary',async()=>{if(!password.input.reportValidity())return;submit.disabled=true;try{await P.call('accountEmails',{action,email,password:password.input.value});password.input.value='';await auth.currentUser.reload();await auth.currentUser.getIdToken(true);await refresh();dialog.close();status.textContent=action==='remove'?'Extra sign-in email removed.':'Primary email updated. All verified emails use the same password.';}catch(e){password.input.value='';feedback.textContent=error(e);}finally{submit.disabled=false;}},'p-btn primary');box.append(feedback,submit);const dialog=P.dialog(action==='remove'?'Remove sign-in email':'Change primary email',box);
    }
    primary.addEventListener('submit',e=>{e.preventDefault();if(!primary.reportValidity())return;run(async()=>{
      const user=auth.currentUser;await user.reload();const target=newEmail.input.value.trim();if(target.toLowerCase()===user.email.toLowerCase())throw Error('That is already your primary email.');
      try{await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,current.input.value));await user.verifyBeforeUpdateEmail(target,{url:'https://nualphaphi.com/portal'});primary.reset();status.textContent='Verification link sent. Open it in your new email inbox to finish changing your primary email.';}finally{current.input.value='';}
    });});
    extra.addEventListener('submit',e=>{e.preventDefault();if(!extraEmail.input.reportValidity()||!extraPassword.input.reportValidity())return;run(async()=>{
      try{await P.call('accountEmails',{action:'request',email:extraEmail.input.value.trim(),password:extraPassword.input.value});code.wrap.hidden=false;verify.hidden=false;code.input.required=true;send.textContent='Send a new code';status.textContent='Code sent. Check your email, then enter the code and your current password.';}finally{extraPassword.input.value='';}
    });});
    verify.onclick=()=>{if(!extra.reportValidity())return;run(async()=>{try{await P.call('accountEmails',{action:'verify',email:extraEmail.input.value.trim(),password:extraPassword.input.value,code:code.input.value.trim()});extra.reset();code.wrap.hidden=true;code.input.required=false;verify.hidden=true;send.textContent='Send code';await refresh();status.textContent='Email verified. You can now sign in with either email and your existing password.';}finally{extraPassword.input.value='';}});};
    const reload=P.button('Refresh email status',()=>run(async()=>{await refresh();status.textContent='Email status updated.'}));section.append(reload);
    run(async()=>{await refresh();status.textContent='';});
  };
})();
