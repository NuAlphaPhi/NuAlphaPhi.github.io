const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(file,auth){
 const nodes=new Map();
 function el(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:true,disabled:false,textContent:'',handlers:{},addEventListener(k,f){this.handlers[k]=f},reportValidity(){return true},focus(){},reset(){this.wasReset=true},querySelector(){return el(id+'-submit')},classList:{toggle(){}},setAttribute(){},getAttribute(){return ''}});return nodes.get(id)}
 const document={getElementById:el,querySelectorAll:()=>[],documentElement:el('root')};
 const window={napOnAuthReady(){},napSaveButtonStart(b){b.disabled=true},napSaveButtonDone(b){b.disabled=false}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{document,window,auth,fetch:async()=>({json:async()=>({result:{accepted:true}})}),firebase:{auth:{EmailAuthProvider:{credential:(email,password)=>({email,password})}}}}, {filename:file});
 return {el,submit:async id=>{await el(id).handlers.submit.call(el(id),{preventDefault(){}});await new Promise(r=>setImmediate(r))}};
}
test('forgot password trims email, handles unknown accounts privately, and permits retry on failure',async()=>{
 let email,code='auth/user-not-found';const h=setup('js/portal-login.js',{sendPasswordResetEmail:async value=>{email=value;throw {code}}});
 h.el('reset-email').value=' brother@example.com ';await h.submit('passwordResetForm');
 assert.equal(email,'brother@example.com');assert.match(h.el('reset-feedback').textContent,/If an account/);assert.equal(h.el('passwordResetForm-submit').disabled,false);
 code='auth/network-request-failed';await h.submit('passwordResetForm');assert.match(h.el('reset-feedback').textContent,/connection/);
});
test('password change verifies current password before updating and rejects mismatches',async()=>{
 const calls=[];let reject=false;const h=setup('js/portal-account-settings.js',{currentUser:{email:'brother@example.com',reload:async()=>{},reauthenticateWithCredential:async c=>{calls.push(['verify',c.password]);if(reject)throw {code:'auth/wrong-password'}},updatePassword:async p=>calls.push(['update',p])}});
 h.el('settings-current-password').value='old-password';h.el('settings-new-password').value='new-password';h.el('settings-confirm-new-password').value='different';await h.submit('passwordChangeForm');assert.equal(calls.length,0);
 h.el('settings-confirm-new-password').value='new-password';reject=true;await h.submit('passwordChangeForm');assert.equal(calls.length,1);assert.match(h.el('password-change-error').textContent,/incorrect/);
 reject=false;await h.submit('passwordChangeForm');assert.deepEqual(calls.slice(-2),[['verify','old-password'],['update','new-password']]);assert.equal(h.el('passwordChangeForm').wasReset,true);assert.match(h.el('password-change-feedback').textContent,/Password updated/);
});
