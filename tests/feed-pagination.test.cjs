const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('js/portal-985-feed.js','utf8');
test('feed distinguishes loading, more posts, and exhausted history',()=>{
 const button={classList:{toggle(){}}};const ctx={moreControls:{home:button},feedLoading:true,feedHasMore:true};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('  function updateMore()'),src.indexOf('  let latestPosts=')),ctx);
 vm.runInContext('updateMore()',ctx);assert.equal(button.disabled,true);assert.equal(button.textContent,'Loading posts…');
 ctx.feedLoading=false;vm.runInContext('updateMore()',ctx);assert.equal(button.disabled,false);assert.equal(button.textContent,'Load more');
 ctx.feedHasMore=false;vm.runInContext('updateMore()',ctx);assert.equal(button.disabled,true);assert.match(button.textContent,/no older posts/);
});
