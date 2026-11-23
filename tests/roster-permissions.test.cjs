const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/portal-985-roster.js','utf8');
function permission(flag,canonical=true,uid='u',signedIn='u'){
 const ctx={P:{me:{isAdmin:flag},uid},window:{napIsAdmin:()=>canonical},auth:{currentUser:signedIn?{uid:signedIn}:null}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const canManageRoster'),source.indexOf('  let classes'))+';result=canManageRoster();',ctx);return !!ctx.result;
}
test('normal, malformed, signed-out and stale-account states cannot manage roster',()=>{
 for(const value of [false,undefined,null,'false','true',1])assert.equal(permission(value),false);
 assert.equal(permission(true,false),false);assert.equal(permission(true,true,'old','new'),false);assert.equal(permission(true,true,'u',null),false);
});
test('verified current admin retains roster management',()=>assert.equal(permission(true),true));
test('class management actions are guarded while suggestions remain outside the guard',()=>{
 assert.match(source,/if \(canManageRoster\(\)\) \{\s*const actions[\s\S]*?Edit Class[\s\S]*?Add Brother[\s\S]*?\}\s*const suggest/);
});
