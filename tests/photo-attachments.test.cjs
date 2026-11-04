const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('paste stages a photo, expands and removes it; text and busy uploads remain untouched',()=>{
 const node=()=>({children:[],append(...x){this.children.push(...x)},replaceChildren(){this.children=[]},setAttribute(){},addEventListener(k,f){this[k]=f}});
 let dialog,revoked=[],busy=false;const P={el:node,button:(text,click)=>Object.assign(node(),{text,click}),dialog:(title,image)=>{dialog=image}};
 vm.runInNewContext(fs.readFileSync('js/portal-985-attachments.js','utf8'),{window:{P985:P},URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL:u=>revoked.push(u)}});
 const form=node(),picker=node(),holder=node(),photo={type:'image/png'},attachment=P.photoAttachment(form,picker,holder,()=>busy);
 let prevented=false;const paste={clipboardData:{items:[{kind:'file',type:'image/png',getAsFile:()=>photo}]},preventDefault(){prevented=true}};
 form.paste(paste);assert.equal(attachment.file,photo);assert.ok(prevented);assert.equal(holder.children.length,2);
 holder.children[0].click();assert.equal(dialog.src,'blob:preview');
 busy=true;holder.children[1].click();assert.equal(attachment.file,photo);busy=false;
 holder.children[1].click();assert.equal(attachment.file,null);assert.equal(holder.children.length,0);assert.equal(revoked.length,1);
 prevented=false;form.paste({clipboardData:{items:[{kind:'string',type:'text/plain'}]},preventDefault(){prevented=true}});assert.equal(prevented,false);
 picker.files=[photo];picker.onchange();assert.equal(attachment.file,photo);attachment.clear();assert.equal(attachment.file,null);
});
