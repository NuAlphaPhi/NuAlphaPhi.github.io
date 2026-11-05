const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
test('bare event routes redirect to listing without intercepting invitations',()=>{
 const {document}=parseHTML(fs.readFileSync('event/index.html','utf8')),script=document.querySelector('head script').textContent;
 for(const [pathname,search,expected] of [['/event','','/events/'],['/event/','','/events/'],['/event/abc','',''],['/event/','?id=abc','']]){
 let target='';vm.runInNewContext(script,{URLSearchParams,location:{pathname,search,replace:x=>target=x}});assert.equal(target,expected);
 }
});
test('unknown URLs show page-not-found while event routes retain invitation rendering',()=>{
 const html=fs.readFileSync('404.html','utf8');
 for(const path of ['/bad-link','/event/abc','/event/a/b']){
 const {document}=parseHTML(html);vm.runInNewContext(document.querySelector('head script').textContent,{document,location:{pathname:path}});
 assert.equal(document.documentElement.classList.contains('event-route'),path==='/event/abc');assert.match(document.getElementById('notFound').textContent,/PAGE NOT FOUND/);
 }
 let calls=0;vm.runInNewContext(fs.readFileSync('event/fallback.js','utf8'),{location:{pathname:'/bad-link'},document:{createElement(){calls++;}}});assert.equal(calls,0);
});
