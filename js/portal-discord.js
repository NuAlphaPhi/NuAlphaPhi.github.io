(function(){
 'use strict';const P=P985,OWNER='vfC9YS7AqvY3Hyr0pfGYg38GVzs1';
 let cache=null;
 P.renderDiscordLinks=async root=>{
  if(P.uid!==OWNER)return;
  const bar=P.el('div','p-discord-toolbar'),search=P.field('Search usernames, nicknames, brothers or roles','search'),filter=P.select('Show',['Unlinked brothers','Linked members','All unlinked members'],'Unlinked brothers'),list=P.el('div','p-discord-list'),pager=P.el('div','p-discord-pager'),status=P.el('p','p-muted','Loading Discord members…');let data=cache,page=0;
  const refresh=P.button('Refresh',async()=>{refresh.disabled=true;try{data=await P.call('discordPortal',{action:'list'});cache=data;page=0;draw();}catch(e){status.textContent=e.message;}finally{refresh.disabled=false;}},'p-btn');
  bar.append(search.wrap,filter.wrap,refresh);root.append(P.el('p','p-muted','Only VIRO can access this section. Link a Discord member to their brother identity, then assign their Bros and chapter roles and default server nickname.'),bar,status,list,pager);
  async function choose(member){
   const box=P.el('div'),field=P.field('Find a brother by real name, pledge name, chapter or class','search'),results=P.el('div','p-discord-picker');box.append(P.el('p','',member.username+(member.nickname?' · '+member.nickname:'')),field.wrap,results);const dialog=P.dialog('Link Discord account',box);
   function drawChoices(){const q=field.input.value.trim().toLowerCase();results.replaceChildren();const choices=data.people.filter(p=>[p.name,p.pledgeName,p.chapter,p.pledgeClass].join(' ').toLowerCase().includes(q)).slice(0,40);
    for(const person of choices){const button=P.button(person.pledgeName+' · '+person.name+' — '+person.chapter+' / '+person.pledgeClass,async()=>{
      button.disabled=true;try{const preview=await P.call('discordPortal',{action:'preview',discordID:member.id,identityKey:person.key});confirm(preview,dialog);}catch(e){P.error(box,e);}finally{button.disabled=false;}
     },'p-btn');results.append(button);}if(!choices.length)results.append(P.empty('No matching brothers.'));
   }
   function confirm(preview,dialog){const p=preview.person;box.replaceChildren(P.el('h3','',p.pledgeName+' · '+p.name),P.el('p','',p.chapter+' Chapter · '+p.pledgeClass+' Class'),P.el('p','p-muted','Crossed '+[p.term,p.year].filter(Boolean).join(' ')),P.el('p','','Big: '+(p.big||'Not recorded')),P.el('p','','Littles: '+(p.littles.join(', ')||'None recorded')),P.el('p','','Discord: @'+preview.username+(preview.nickname?' · '+preview.nickname:'')));
    let acknowledge=null;
    if(preview.requiresAdditionalConfirmation){
     const warning=P.el('div','p-discord-link-warning');warning.setAttribute('role','note');
     warning.append(P.el('strong','','This brother already has a linked Discord account.'),P.el('p','','Are you sure you want to link another account to this brother? Existing accounts will stay linked.'));
     for(const account of preview.existingAccounts||[])warning.append(P.el('p','p-muted',(account.username?'@'+account.username:'Discord ID '+account.id)+(account.nickname?' · '+account.nickname:'')));
     const label=P.el('label','p-discord-link-ack');acknowledge=document.createElement('input');acknowledge.type='checkbox';label.append(acknowledge,P.el('span','','Yes, this is another Discord account belonging to the same brother.'));warning.append(label);box.append(warning);
    }
    const confirmButton=P.button(preview.requiresAdditionalConfirmation?'Link additional account':'Confirm link',async()=>{confirmButton.disabled=true;try{const result=await P.call('discordPortal',{action:'confirm',requestID:preview.requestID,confirmAdditionalAccount:acknowledge?.checked===true});dialog.close();cache=null;data=await P.call('discordPortal',{action:'list'});cache=data;draw();if(result.warning)P.dialog('Link saved · server updates need attention',P.el('p','',result.warning));}catch(e){P.error(box,e);}finally{confirmButton.disabled=!!acknowledge&&!acknowledge.checked;}},'p-btn p-primary');if(acknowledge){confirmButton.disabled=true;acknowledge.onchange=()=>{confirmButton.disabled=!acknowledge.checked;};}box.append(confirmButton);
   }
   field.input.oninput=drawChoices;drawChoices();field.input.focus();
  }
  function editNickname(member,person){
   const box=P.el('div'),field=P.field('Server nickname','text');field.input.value=member.nickname||member.displayName||member.username;field.input.maxLength=32;
   const term={fall:'Fall',spring:'Spring',summer:'Summer'}[String(person?.term||'').toLowerCase()],defaultName=person?.pledgeName&&term&&person.year?person.pledgeName+' / '+term+' '+person.year:null;
   box.append(P.el('p','p-muted','Changes this server only. Discord usernames stay unchanged.'),field.wrap,P.el('p','p-muted',defaultName?'Default: '+defaultName:'Add crossing details to the portal record to use the default nickname.'));
   const actions=P.el('div','p-discord-toolbar'),dialog=P.dialog('Edit server nickname',box);
   async function save(useDefault){custom.disabled=true;reset.disabled=true;try{const result=await P.call('discordPortal',{action:'nickname',discordID:member.id,useDefault,nickname:field.input.value});member.nickname=result.nickname;cache=data;dialog.close();draw();}catch(e){P.error(box,e);}finally{custom.disabled=false;reset.disabled=!defaultName;}}
   const custom=P.button('Save nickname',()=>save(false),'p-btn p-primary'),reset=P.button('Use default',()=>save(true),'p-btn');reset.disabled=!defaultName;actions.append(custom,reset);box.append(actions);field.input.focus();
  }
  function draw(){if(!data)return;list.replaceChildren();pager.replaceChildren();const roleMap=new Map(data.roles.map(r=>[r.id,r.name])),people=new Map(data.people.map(p=>[p.key,p]));const q=search.input.value.toLowerCase().trim();const rows=data.members.filter(m=>filter.input.value==='Linked members'?!!m.identityKey:!m.identityKey&&(filter.input.value==='All unlinked members'||m.bro)).filter(m=>{const p=people.get(m.identityKey);return [m.username,m.nickname,m.displayName,p?.name,p?.pledgeName,...m.roles.map(id=>roleMap.get(id))].join(' ').toLowerCase().includes(q);}).sort((a,b)=>(a.nickname||a.username).localeCompare(b.nickname||b.username));
   const pages=Math.max(1,Math.ceil(rows.length/20));page=Math.min(page,pages-1);status.textContent=rows.length+' members · Page '+(page+1)+' of '+pages;
   for(const m of rows.slice(page*20,page*20+20)){const row=P.el('article','p-discord-member'),identity=P.el('div','p-discord-identity'),names=P.el('div');if(m.avatar){const img=P.el('img','p-discord-avatar');img.src=m.avatar;img.alt='';img.loading='lazy';identity.append(img);}else identity.append(P.el('span','p-discord-avatar',m.username.slice(0,2).toUpperCase()));
    names.append(P.el('strong','',m.nickname||m.displayName||m.username),P.el('div','p-muted','@'+m.username),P.el('small','p-muted','Server nickname: '+(m.nickname||'Not set')));identity.append(names);row.append(identity);const tags=P.el('div','p-discord-roles');m.roles.forEach(id=>{if(roleMap.has(id))tags.append(P.el('span','',roleMap.get(id)));});row.append(tags);
    const person=people.get(m.identityKey);if(m.identityKey){row.append(P.button('Edit nickname',()=>editNickname(m,person),'p-btn'),P.el('p','',person?person.pledgeName+' · '+person.name+' · '+person.chapter:'Linked record unavailable'),P.button('Retry roles',()=>P.run(row,async()=>{const r=await P.call('discordPortal',{action:'roles',discordID:m.id});P.dialog('Discord roles',P.el('p','',r.message));}),'p-btn'));}else row.append(P.button('Link brother',()=>choose(m),'p-btn p-primary'));list.append(row);
   }
   if(!rows.length)list.append(P.empty('No members match.'));
   for(const [label,n]of [['Previous',page-1],['Next',page+1]]){const b=P.button(label,()=>{page=n;draw();},'p-btn');b.disabled=n<0||n>=pages;pager.append(b);}
  }
  search.input.oninput=()=>{page=0;draw();};filter.input.onchange=()=>{page=0;draw();};if(data)draw();else refresh.click();
 };
 P.appendDiscordSocial=(container,profileID)=>{P.call('discordPortal',{action:'profile',profileID}).then(({discord,discords})=>{for(const account of discords||(discord?[discord]:[])){const a=P.el('a','p-profile-social','Discord · @'+account.username);a.href='https://discord.com/users/'+account.id;a.target='_blank';a.rel='noopener noreferrer';container.append(a);}}).catch(()=>{});};
})();
