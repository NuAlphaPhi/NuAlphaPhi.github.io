const test = require('node:test');
const assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const vm = require('node:vm');
const fs = require('node:fs');

test('returning to loaded pages preserves content without network verification or loader flashes', async () => {
  const {window, document} = parseHTML(`<html><body>
    <button class="portal-shell__nav-btn" data-tab="home">Home</button>
    <button class="portal-shell__nav-btn" data-tab="gallery">Gallery</button>
    <div id="portalRouteLoading" hidden><p></p><button></button></div>
    <main class="portal-shell__main"><section class="portal-tab-panel" data-panel="home"><p id="saved-post">Loaded post</p></section>
    <section class="portal-tab-panel" data-panel="gallery" hidden>Loaded albums</section></main></body></html>`);
  const location = {pathname:'/portal/home', search:'', hash:'', assign(url){this.redirect=url;}};
  window.NAP_AUTH_READY_DETAIL={uid:'bro',profile:{membershipStatus:'approved'}};
  const auth={currentUser:{uid:'bro'},signOut:async()=>{auth.currentUser=null;}};
  const ctx={window,document,location,history:{pushState(){},replaceState(){}},auth,
    db:{collection(){throw Error('Navigation must not refetch');}},setTimeout,clearTimeout,CustomEvent:window.CustomEvent};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/portal-routes.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('js/portal-shell.js','utf8'),ctx);
  const post=document.getElementById('saved-post');
  const main=document.querySelector('main'); main.scrollTop=240;
  await window.napSetTab('gallery');
  assert.equal(document.getElementById('portalRouteLoading').hidden,true);
  await window.napSetTab('home');
  assert.equal(document.getElementById('saved-post'),post);
  assert.equal(main.scrollTop,240);
  assert.equal(document.getElementById('portalRouteLoading').hidden,true);
  auth.currentUser=null;
  await window.napSetTab('gallery');
  assert.match(location.redirect,/^\/portal\/login\?next=/);
});
