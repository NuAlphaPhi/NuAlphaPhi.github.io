const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const source = fs.readFileSync('js/portal-gallery.js', 'utf8');
function fn(name) {
  const start = source.indexOf('  function ' + name + '(');
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
test('missing covers follow one photo, survive album refreshes and release listeners', () => {
  const listeners = new Map();
  let reads = 0, stops = 0;
  const c = {
    allAlbums: [{id: 'gala', photoCount: 240}, {id: 'saved', coverUrl: 'saved.jpg'}],
    autoCovers: new Map(), renderAlbumGrid() {},
    db: {collection() {return {doc(id) {return {collection() {return {
      limit(n) {assert.equal(n, 1); return {onSnapshot(next) {
        reads++; listeners.set(id, next); return () => stops++;
      }};}
    };}};}};}}
  };
  vm.createContext(c);
  vm.runInContext(fn('findAlbum') + fn('syncAutoCovers'), c);
  c.syncAutoCovers();
  assert.equal(reads, 1);
  const emit = photo => listeners.get('gala')({docs: photo ? [{data: () => photo}] : []});
  emit({url: 'full.jpg', thumbUrl: 'thumb.jpg'});
  assert.equal(c.allAlbums[0].autoCoverUrl, 'thumb.jpg');
  c.allAlbums = [{id: 'gala', photoCount: 239}];
  c.syncAutoCovers();
  assert.equal(reads, 1);
  assert.equal(c.allAlbums[0].autoCoverUrl, 'thumb.jpg');
  emit({url: 'replacement.jpg'});
  assert.equal(c.allAlbums[0].autoCoverUrl, 'replacement.jpg');
  emit(null);
  assert.equal(c.allAlbums[0].autoCoverUrl, null);
  c.allAlbums[0].coverUrl = 'chosen.jpg';
  c.syncAutoCovers();
  assert.equal(stops, 1);
  assert.equal(c.autoCovers.size, 0);
});
test('cards prefer saved covers, support thumbnail-only albums and use automatic covers', () => {
  const {document} = parseHTML('<html></html>');
  const c = {document, canManageAlbum: () => false, IMAGE_ICON_SVG: ''};
  vm.createContext(c);
  vm.runInContext(fn('escapeHtml') + fn('albumCardHtml'), c);
  for (const [fields, expected] of [
    [{coverUrl:'full.jpg', coverThumbUrl:'thumb.jpg', autoCoverUrl:'auto.jpg'}, 'thumb.jpg'],
    [{coverThumbUrl:'thumb.jpg'}, 'thumb.jpg'],
    [{autoCoverUrl:'auto.jpg'}, 'auto.jpg']
  ]) {
    const host = document.createElement('div');
    host.innerHTML = c.albumCardHtml({id:'gala', title:'Gala 2026', ...fields});
    assert.equal(host.querySelector('img').getAttribute('src'), expected);
  }
  assert.match(c.albumCardHtml({id:'empty'}), /cover--empty/);
});
