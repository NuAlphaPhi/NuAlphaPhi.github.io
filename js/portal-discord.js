(function(){
 'use strict';const P=P985,OWNER='vfC9YS7AqvY3Hyr0pfGYg38GVzs1';
 let cache=null;
 P.renderDiscordLinks=async root=>{
  if(P.uid!==OWNER)return;
  const bar=P.el('div','p-discord-toolbar'),search=P.field('Search usernames, nicknames, brothers or roles','search'),filter=P.select('Show',['Unlinked brothers','Linked members','All unlinked members'],'Unlinked brothers'),list=P.el('div','p-discord-list'),pager=P.el('div','p-discord-pager'),status=P.el('p','p-muted','Loading Discord members…');let data=cache,page=0;
  const refresh=P.button('Refresh',async()=>{refresh.disabled=true;try{data=await P.call('discordPortal',{action:'list'});cache=data;page=0;draw();}catch(e){status.textContent=e.message;}finally{refresh.disabled=false;}},'p-btn');
  bar.append(search.wrap,filter.wrap,refresh);root.append(P.el('p','p-muted','Only VIRO can access this section. Link a Discord member to their brother identity, then assign their Bros and chapter roles.'),bar,status,list,pager);
  async function choose(member){
   const box=P.el('div'),field=P.field('Find a brother by real name, pledge name, chapter or class','search'),results=P.el('div','p-discord-picker');box.append(P.el('p','',member.username+(member.nickname?' · '+member.nickname:'')),field.wrap,results);const dialog=P.dialog('Link Discord account',box);
   function drawChoices(){const q=field.input.value.trim().toLowerCase();results.replaceChildren();const choices=data.people.filter(p=>[p.name,p.pledgeName,p.chapter,p.pledgeClass].join(' ').toLowerCase().includes(q)).slice(0,40);
    for(const person of choices){const button=P.button(person.pledgeName+' · '+person.name+' — '+person.chapter+' / '+person.pledgeClass,async()=>{
      button.disabled=true;try{const preview=await P.call('discordPortal',{action:'preview',discordID:member.id,identityKey:person.key});confirm(preview,dialog);}catch(e){P.error(box,e);}finally{button.disabled=false;}
     },'p-btn');results.append(button);}if(!choices.length)results.append(P.empty('No matching brothers.'));
   }
   function confirm(preview,dialog){const p=preview.person;box.replaceChildren(P.el('h3','',p.pledgeName+' · '+p.name),P.el('p','',p.chapter+' Chapter · '+p.pledgeClass+' Class'),P.el('p','p-muted','Crossed '+[p.term,p.year].filter(Boolean).join(' ')),P.el('p','','Big: '+(p.big||'Not recorded')),P.el('p','','Littles: '+(p.littles.join(', ')||'None recorded')),P.el('p','','Discord: @'+preview.username+(preview.nickname?' · '+preview.nickname:'')));
    const confirmButton=P.button('Confirm link',async()=>{confirmButton.disabled=true;try{const result=await P.call('discordPortal',{action:'confirm',requestID:preview.requestID});dialog.close();cache=null;data=await P.call('discordPortal',{action:'list'});cache=data;draw();if(result.warning)P.dialog('Link saved · roles need attention',P.el('p','',result.warning));}catch(e){P.error(box,e);}finally{confirmButton.disabled=false;}},'p-btn p-primary');box.append(confirmButton);
   }
   field.input.oninput=drawChoices;drawChoices();field.input.focus();
  }
  function draw(){if(!data)return;list.replaceChildren();pager.replaceChildren();const roleMap=new Map(data.roles.map(r=>[r.id,r.name])),people=new Map(data.people.map(p=>[p.key,p]));const q=search.input.value.toLowerCase().trim();const rows=data.members.filter(m=>filter.input.value==='Linked members'?!!m.identityKey:!m.identityKey&&(filter.input.value==='All unlinked members'||m.bro)).filter(m=>{const p=people.get(m.identityKey);return [m.username,m.nickname,m.displayName,p?.name,p?.pledgeName,...m.roles.map(id=>roleMap.get(id))].join(' ').toLowerCase().includes(q);}).sort((a,b)=>(a.nickname||a.username).localeCompare(b.nickname||b.username));
   const pages=Math.max(1,Math.ceil(rows.length/20));page=Math.min(page,pages-1);status.textContent=rows.length+' members · Page '+(page+1)+' of '+pages;
   for(const m of rows.slice(page*20,page*20+20)){const row=P.el('article','p-discord-member'),identity=P.el('div','p-discord-identity'),names=P.el('div');if(m.avatar){const img=P.el('img','p-discord-avatar');img.src=m.avatar;img.alt='';img.loading='lazy';identity.append(img);}else identity.append(P.el('span','p-discord-avatar',m.username.slice(0,2).toUpperCase()));
    names.append(P.el('strong','',m.nickname||m.displayName||m.username),P.el('div','p-muted','@'+m.username),P.el('small','p-muted','Server nickname: '+(m.nickname||'Not set')));identity.append(names);row.append(identity);const tags=P.el('div','p-discord-roles');m.roles.forEach(id=>{if(roleMap.has(id))tags.append(P.el('span','',roleMap.get(id)));});row.append(tags);
    const person=people.get(m.identityKey);if(m.identityKey){row.append(P.el('p','',person?person.pledgeName+' · '+person.name+' · '+person.chapter:'Linked record unavailable'),P.button('Retry roles',()=>P.run(row,async()=>{const r=await P.call('discordPortal',{action:'roles',discordID:m.id});P.dialog('Discord roles',P.el('p','',r.message));}),'p-btn'));}else row.append(P.button('Link brother',()=>choose(m),'p-btn p-primary'));list.append(row);
   }
   if(!rows.length)list.append(P.empty('No members match.'));
   for(const [label,n]of [['Previous',page-1],['Next',page+1]]){const b=P.button(label,()=>{page=n;draw();},'p-btn');b.disabled=n<0||n>=pages;pager.append(b);}
  }
  search.input.oninput=()=>{page=0;draw();};filter.input.onchange=()=>{page=0;draw();};if(data)draw();else refresh.click();
 };
 P.appendDiscordSocial=(container,profileID)=>{P.call('discordPortal',{action:'profile',profileID}).then(({discord})=>{if(!discord)return;const a=P.el('a','p-profile-social','Discord · @'+discord.username);a.href='https://discord.com/users/'+discord.id;a.target='_blank';a.rel='noopener noreferrer';container.append(a);}).catch(()=>{});};
})();
