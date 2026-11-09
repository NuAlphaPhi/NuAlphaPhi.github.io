const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function setup(path='/portal/home/post-one'){
 const {window,document}=parseHTML('<html><body><button class="portal-shell__nav-btn" data-tab="home"></button><button class="portal-shell__nav-btn" data-tab="channels"></button><div id="portalRouteLoading" hidden><p></p><button></button></div><main class="portal-shell__main"><section class="portal-tab-panel" data-panel="home"></section><section class="portal-tab-panel" data-panel="post"></section><section class="portal-tab-panel" data-panel="channels"></section></main></body></html>');
 const location={pathname:path,search:'',hash:'',assign(url){this.redirect=url;}},entries=[];
 const history={pushState(a,b,url){entries.push(url);location.pathname=url;},replaceState(a,b,url){location.pathname=url;}};
 window.NAP_AUTH_READY_DETAIL={uid:'member',profile:{membershipStatus:'approved'}};
 const c={window,document,location,history,auth:{currentUser:{uid:'member'}},setTimeout,clearTimeout,CustomEvent:window.CustomEvent};vm.createContext(c);
 vm.runInContext(fs.readFileSync('js/portal-routes.js','utf8'),c);
 return {c,window,document,location,entries,R:window.NAP_ROUTES};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('all requested detail URLs parse while public events and unsafe paths stay separate',()=>{
 const {R}=setup();
 for(const [path,kind,id]of [['/portal/admin/newlycrossed','admin','newlycrossed'],['/portal/linktree/kappa','linktree','kappa'],['/portal/gallery/album-1','gallery','album-1'],['/portal/events/event-1','events','event-1'],['/portal/messages/group-1','messages','group-1'],['/portal/channel/finance','channels','finance'],['/portal/home/post-1','home','post-1']]){
  assert.equal(R.read(path).kind,kind);assert.equal(R.read(path).id,id);assert.equal(R.path(kind,id),path);
 }
 for(const path of ['/events','/home/post-one','//evil.com/home/x','/portal/home/a/b','/portal/home/%2fsecret','/portal/home/%5csecret','/portal/home/%','/portal/home/..'])assert.equal(R.read(path),null,path);
 assert.equal(R.slug('Newly Crossed'),'newlycrossed');
 assert.equal(new Set(R.sections.map(R.slug)).size,R.sections.length);
});
test('detail restoration waits for auth and data, handles refresh and Back without duplicate entries',async()=>{
 const {c,R,window,location,entries}=setup();let dataReady=false,opened=[];
 R.register('home',id=>{if(!dataReady)return false;opened.push(id);window.napSetTab('post','home',R.options('home',id));});
 R.restore();assert.equal(opened.length,0);
 vm.runInContext(fs.readFileSync('js/portal-shell.js','utf8'),c);await tick();assert.equal(opened.length,0);
 dataReady=true;R.restore();await tick();assert.deepEqual(opened,['post-one']);assert.equal(entries.length,0);
 await window.napSetTab('post','home',R.options('home','post-two'));assert.equal(location.pathname,'/portal/home/post-two');assert.equal(entries.length,1);
 R.restore();assert.deepEqual(opened,['post-one']);
 location.pathname='/portal/home/post-one';window.dispatchEvent(new window.Event('popstate'));await tick();assert.deepEqual(opened,['post-one','post-one']);assert.equal(entries.length,1);
});
test('signed-out direct links preserve their full destination',async()=>{
 const {c,location}=setup('/portal/channel/finance');c.auth.currentUser=null;
 vm.runInContext(fs.readFileSync('js/portal-shell.js','utf8'),c);await tick();
 assert.equal(location.redirect,'/portal/login?next=%2Fportal%2Fchannel%2Ffinance');
});
test('old portal-home bookmarks become portal URLs and all section links retain portal',()=>{
 const {location,R}=setup('/portal-home/channels/finance');
 assert.equal(location.pathname,'/portal/channels/finance');
 assert.equal(R.path('channels','finance'),'/portal/channel/finance');
 assert.equal(R.base('home'),'/portal');
 for(const tab of ['home','admin','gallery','events','linktree','channels','messages','directory','roster','family-tree','myprofile'])assert.match(R.base(tab),/^\/portal(?:\/|$)/);
});
test('sign-in returns to portal deep links and rejects outside destinations',()=>{
 const source=fs.readFileSync('js/portal-login.js','utf8');
 const fn=source.slice(source.indexOf('  function destination()'),source.indexOf('  var toggleBtns'));
 const destination=next=>vm.runInNewContext(fn+'\ndestination()', {URLSearchParams,location:{search:'?next='+encodeURIComponent(next)}});
 for(const path of ['/portal','/portal/home/post-one','/portal/channel/finance','/portal/admin/newlycrossed','/portal/profile/viro'])assert.equal(destination(path),path);
 assert.equal(destination('/portal-home/messages/chat-1'),'/portal/messages/chat-1');
 for(const path of ['//evil.com','https://evil.com','/portal/login','/portal/../outside'])assert.equal(destination(path),'/portal');
});
