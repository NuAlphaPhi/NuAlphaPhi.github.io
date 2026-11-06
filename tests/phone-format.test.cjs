const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{},document:{getElementById:()=>null}};
vm.runInNewContext(fs.readFileSync('js/portal-phone.js','utf8'),context);
const p=context.window.napPhone;
test('legacy and explicit US numbers have consistent presentation',()=>{
 for(const value of ['6262779939','16262779939','+16262779939','(626) 277-9939'])assert.equal(p.format(value),'+1 626-277-9939');
 assert.equal(p.format(''),'');assert.equal(p.format('+44 20 7946 0958'),'+44 20 7946 0958');
});
test('signup normalizes formatted and pasted numbers without duplicate country codes',()=>{
 for(const value of ['6262779939','16262779939','+1 (626)277-9939'])assert.equal(p.canonical(value,'+1'),'+16262779939');
 assert.equal(p.canonical('2079460958','+44'),'+442079460958');
 assert.equal(p.canonical('+852 2345 6789','+1'),'+85223456789');
 for(const value of ['123','626277993999','abc'])assert.equal(p.canonical(value,'+1'),'');
});
test('typing US phone digits uses hyphens, including partial numbers',()=>{
 assert.equal(p.us('123'),'123');assert.equal(p.us('1234'),'123-4');assert.equal(p.us('1234567'),'123-456-7');assert.equal(p.us('1234567890'),'123-456-7890');
});
