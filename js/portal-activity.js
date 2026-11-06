(function(){
 const P=window.P985||window.Portal985;
 if(!P)return;
 const label=s=>String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
 const value=v=>v===null||v===undefined?'Not set':typeof v==='boolean'?(v?'Yes':'No'):typeof v==='object'?JSON.stringify(v):String(v);
 const actor=a=>a.actor?P.name(P.person(a.actor)):'System';
 const verbs={standing:'Changed membership standing',admin:'Changed administrator access',assign:'Changed an officer assignment','application-approved':'Approved an account request','application-rejected':'Rejected an account request'};
 P.renderActivity=(content,audit)=>{
  const search=P.field('Search activity','search'),action=P.select('Action',['All actions',...new Set(audit.map(a=>a.action))],'All actions'),person=P.select('Person',['Everyone',...new Set(audit.map(actor))],'Everyone'),sort=P.select('Sort by',['Newest first','Oldest first','Action','Person'],'Newest first'),list=P.el('div','p-activity-list');
  content.append(P.row(search.wrap,action.wrap,person.wrap,sort.wrap),list);
  function diff(parent,before,after,left='Before',right='After'){
   const table=P.el('table','p-activity-diff'),head=P.el('tr');['Field',left,right].forEach(t=>head.append(P.el('th','',t)));table.append(head);
   [...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].forEach(k=>{const row=P.el('tr');[label(k),value(before?.[k]),value(after?.[k])].forEach(t=>row.append(P.el('td','',t)));table.append(row);});parent.append(table);
  }
  function render(){list.replaceChildren();const rows=audit.filter(a=>(action.input.value==='All actions'||a.action===action.input.value)&&(person.input.value==='Everyone'||actor(a)===person.input.value)&&JSON.stringify([actor(a),a]).toLowerCase().includes(search.input.value.toLowerCase()));
   if(sort.input.value==='Oldest first')rows.reverse();if(sort.input.value==='Action')rows.sort((a,b)=>a.action.localeCompare(b.action));if(sort.input.value==='Person')rows.sort((a,b)=>actor(a).localeCompare(actor(b)));
   rows.forEach(a=>{const card=P.el('article','p-card p-activity-entry'),target=[a.uid?P.name(P.person(a.uid)):'',a.detail,a.slot,a.resource].filter(Boolean).join(' · ');
    card.append(P.el('strong','',actor(a)+' · '+(verbs[a.action]||label(a.action))),P.el('small','p-muted',P.when(a.createdAt)),P.el('p','',target));
    if(a.before||a.after){const details=P.el('details'),summary=P.el('summary','','View changes');details.append(summary);diff(details,a.before,a.after);card.append(details);}
    if(a.before&&a.after&&['standing','admin','assign'].includes(a.action))card.append(P.button('Review revert',()=>P.run(card,async()=>{
     const preview=await P.call('previewActivityRevert',{id:a.id}),body=P.el('div');body.append(P.el('p','',preview.canRevert?'Review the change below. Confirming restores the earlier value and adds a new activity entry.':'This record has changed since this action. Revert is blocked to protect newer changes.'));diff(body,preview.current,preview.proposed,'Current','After revert');
     if(preview.canRevert)body.append(P.button('Confirm revert',()=>P.run(body,async()=>{const data={action:a.action,uid:a.action==='assign'?a.before.uid:a.uid,slot:a.slot,expectedUid:a.after.uid||'',active:a.before.standing==='active',enabled:a.before.enabled===true,revertAuditID:a.id};await P.call('manageLeadership',data);body.replaceChildren(P.el('p','','Change reverted.'));}),'p-btn primary'));
     P.dialog('Confirm Revert',body);
    })));
    else card.append(P.el('small','p-muted','Automatic revert unavailable for this action.'));
    list.append(card);
   });if(!rows.length)list.append(P.empty('No matching activity.'));
  }
  [search,action,person,sort].forEach(f=>{f.input.addEventListener('input',render);f.input.addEventListener('change',render);});render();
 };
})();
