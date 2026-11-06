(function(root){
 'use strict';
 const themes=['dark','darker','light','maroon'];
 const validAccent=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16));
 const hex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
 const luminance=h=>rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 function readable(color,background,target,destination){const original=rgb(color),end=rgb(destination);for(let i=0;i<=100;i++){const candidate=hex(original.map((v,j)=>v+(end[j]-v)*i/100));if(contrast(candidate,background)>=target)return candidate;}return destination;}
 function palette(color,theme){const light=theme==='light';return {text:readable(color,light?'#eeeef2':'#40202e',4.5,light?'#000000':'#ffffff'),button:readable(color,'#ffffff',4.5,'#000000')};}
 function apply(theme,accent){theme=themes.includes(theme)?theme:'dark';document.documentElement.dataset.theme=theme;const style=document.body.style;for(const key of ['--maroon','--maroon-dark','--maroon-soft','--portal-accent','--portal-button','--portal-button-hover'])style.removeProperty(key);if(validAccent(accent)){const p=palette(accent,theme);style.setProperty('--maroon',p.text);style.setProperty('--maroon-dark',p.text);style.setProperty('--maroon-soft',p.text+'1a');style.setProperty('--portal-accent',p.text);style.setProperty('--portal-button',p.button);style.setProperty('--portal-button-hover',readable(p.button,'#ffffff',6,'#000000'));}try{localStorage.setItem('nap_portal_theme',theme);}catch(e){}}
 const api={themes,validAccent,palette,contrast,apply};if(typeof module!=='undefined')module.exports=api;else root.portalAppearance=api;
})(typeof window!=='undefined'?window:globalThis);
