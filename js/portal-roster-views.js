(function(){const P=P985;
let cache;
P.renderRosterMatrix=(container,data,mode,chapter,query)=>{
 container.replaceChildren();const E=window.NAPRosterExport,stats=mode==='statistics';
 const filtered={...data,people:data.people.filter(r=>(!query||(r.fullName+' '+r.pledgeName).toLowerCase().includes(query.toLowerCase())))};
 let model;try{if(cache&&cache.data===data&&cache.brothers===P.brothers&&cache.query===query)model=cache.model;else{model=E.matrix({...filtered,brothers:P.brothers});cache={data,brothers:P.brothers,query,model};}}catch(error){container.append(P.empty(error.message));return;}
 const chapters=E.CHAPTERS.filter(c=>!chapter||c===chapter),intro=P.el('div','p-roster-view-summary');
 intro.append(P.el('h2','',stats?'Crossing Statistics':'Crossing Timeline'),P.el('p','p-muted','Historical roster · '+model.total.toLocaleString()+' brothers'+(query?' matching your search':'')+' · Includes disaffiliated and fallen brothers.'));
 if(model.warnings.length)intro.append(P.el('p','p-muted','Classes with missing or conflicting crossing dates appear under Needs review.'));
 const scroll=P.el('div','p-roster-matrix-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',stats?'Crossing counts by semester and chapter':'Classes by semester and chapter');
 const table=P.el('table','p-roster-matrix '+(stats?'is-statistics':'is-timeline')),head=P.el('thead'),body=P.el('tbody'),tr=P.el('tr');
 for(const label of ['Year','Semester',...(stats?['Total']:[]),...chapters]){const th=P.el('th','',label);th.scope='col';if(chapters.includes(label))th.style.setProperty('--chapter-color','#'+E.COLORS[E.CHAPTERS.indexOf(label)]);tr.append(th);}head.append(tr);
 function row(p,total=false){const tr=P.el('tr',total?'p-matrix-total':'');tr.append(P.el('th','',total?'All':String(p.year)),P.el('th','',total?'Total':p.term));
 if(stats)tr.append(P.el('td','p-matrix-count',String(total?chapters.reduce((n,ch)=>n+model.totals[E.CHAPTERS.indexOf(ch)],0):p.entries.filter(e=>chapters.includes(e.chapter)).length)));
 chapters.forEach(ch=>{const td=P.el('td'),entries=p.entries?.filter(e=>e.chapter===ch)||[],count=total?model.totals[E.CHAPTERS.indexOf(ch)]:entries.length;
 if(stats){td.textContent=String(count);td.className=count?'p-matrix-count has-crossings':'p-matrix-zero';}
 else if(!entries.length){td.className='p-matrix-empty';td.setAttribute('aria-label','No recorded crossing');}
 else{let cls='';entries.forEach(e=>{if(cls!==e.className){cls=e.className;td.append(P.el('strong','p-matrix-class',cls+' Class'));}const person=P.el('div',e.disaffiliated?'p-matrix-disaffiliated':e.fallen?'p-matrix-fallen':'');person.textContent=e.values[2]+' · '+[e.values[3],e.values[4]].filter(Boolean).join(' ')+(e.fallen?' · RIP':'');if(e.disaffiliated)person.append(P.el('span','p-matrix-status','Disaffiliated'));td.append(person);});}tr.append(td);});body.append(tr);}
 if(stats)row({},true);model.periods.forEach(p=>row(p));table.append(head,body);scroll.append(table);container.append(intro,scroll);
};})();
