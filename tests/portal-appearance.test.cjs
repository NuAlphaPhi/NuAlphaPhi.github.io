const {test}=require('node:test');const assert=require('node:assert/strict');
const {palette,contrast,validAccent}=require('../js/portal-appearance.js');
test('custom accents remain readable in every theme, including extreme colors',()=>{
 for(const theme of ['dark','darker','light','maroon'])for(const color of ['#ffffff','#000000','#ffff00','#00ffff','#0000ff','#ff0000','#7e3047']){
  const p=palette(color,theme);assert.ok(contrast(p.button,'#ffffff')>=4.5);assert.ok(contrast(p.text,theme==='light'?'#eeeef2':'#40202e')>=4.5);
 }
});
test('accent accepts hex colors only',()=>{assert.ok(validAccent('#AA11ff'));for(const value of ['red','#fff','url(x)',null,5])assert.equal(validAccent(value),false);});
