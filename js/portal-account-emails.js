(function () {
  'use strict';
  const P=P985;
  P.renderAccountEmails=function(section){
    section.append(P.el('p','p-muted','Sign in to this same account with your primary email or any extra email. All emails use one password. Password-reset messages go only to your primary email.'));
    const list=P.el('div','settings-account-details'),status=P.el('p','p-muted');status.setAttribute('role','status');section.append(list,status);
    let busy=false;
    function buttons(disabled){section.querySelectorAll('button').forEach(b=>b.disabled=disabled);}
    function error(e){return e.message||'Could not update your emails. Please try again.';}
    async function refresh(){
      await auth.currentUser.reload();const result=await P.call('accountEmails',{action:'list'});list.replaceChildren();
      const row=P.el('div','settings-detail');row.append(P.el('strong','',result.primary),P.el('span','p-muted','Primary · password recovery'));list.append(row);
      for(const a of result.aliases){const r=P.el('div','settings-detail'),actions=P.row();r.append(P.el('strong','',a.email),P.el('span','p-muted','Extra sign-in email'));for(const [action,label]of [['primary','Make primary'],['remove','Remove']])actions.append(P.button(label,()=>emailAction(action,a.email)));r.append(actions);list.append(r);}
      if(!result.aliases.length)list.append(P.el('p','p-muted','No extra sign-in emails yet.'));
      if(P.me.email!==auth.currentUser.email){await P.call('syncAccountEmail',{});P.me.email=auth.currentUser.email;document.dispatchEvent(new Event('p985:people'));}
      const summary=document.getElementById('settingsAccountEmail');if(summary)summary.textContent=auth.currentUser.email;
    }
    async function run(fn){if(busy)return;busy=true;buttons(true);status.textContent='Saving…';try{await fn();}catch(e){status.textContent=error(e);}finally{busy=false;buttons(false);}}
    async function update(action,email,password){const result=await P.call('accountEmails',{action,email,password});if(result.token)await auth.signInWithCustomToken(result.token);await auth.currentUser.reload();await auth.currentUser.getIdToken(true);await refresh();}
    function emailAction(action,email){
      const box=P.el('div'),password=P.field('Current password','password');password.input.required=true;password.input.autocomplete='current-password';
      box.append(P.el('p','p-muted',action==='remove'?`Remove ${email} as a sign-in email? Your other emails will still work.`:`Make ${email} your primary email for sign-in and password recovery? Your previous primary will remain an extra sign-in email.`),password.wrap);
      const feedback=P.el('p','p-muted');feedback.setAttribute('role','status');
      const submit=P.button(action==='remove'?'Remove email':'Make primary',async()=>{if(!password.input.reportValidity())return;submit.disabled=true;try{await update(action,email,password.input.value);dialog.close();status.textContent=action==='remove'?'Extra sign-in email removed.':'Primary email updated. Your password is unchanged.';}catch(e){feedback.textContent=error(e);}finally{password.input.value='';submit.disabled=false;}},'p-btn primary');box.append(feedback,submit);const dialog=P.dialog(action==='remove'?'Remove sign-in email':'Change primary email',box);
    }
    for(const [action,title,label,help]of [['primary','Change primary email','New primary email','This address will receive password-reset emails. Your previous primary will remain an extra sign-in email.'],['add','Add another sign-in email','Extra sign-in email','Add up to five extra emails. Each will work immediately with your existing password.']]){
      const form=P.el('form','p-card'),email=P.field(label,'email'),password=P.field('Current password','password');email.input.required=true;email.input.autocomplete='email';password.input.required=true;password.input.autocomplete='current-password';
      const save=P.el('button','p-btn primary',action==='primary'?'Change primary email':'Add sign-in email');save.type='submit';form.append(P.el('h3','',title),P.el('p','p-muted',help),email.wrap,password.wrap,save);section.append(form);
      form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;run(async()=>{try{await update(action,email.input.value.trim(),password.input.value);form.reset();status.textContent=action==='primary'?'Primary email updated. Your password and account data are unchanged.':'Sign-in email added. Use this email with your existing password.';}finally{password.input.value='';}});});
    }
    section.append(P.button('Refresh email status',()=>run(async()=>{await refresh();status.textContent='Email status updated.';})));
    run(async()=>{await refresh();status.textContent='';});
  };
})();
