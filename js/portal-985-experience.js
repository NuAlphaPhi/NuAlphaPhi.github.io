(function(){
  'use strict'; const P=P985;
  P.toast=(message,undo)=>{document.querySelector('.p-toast')?.remove();const e=P.el('div','p-toast',message);e.setAttribute('role','status');if(undo)e.append(P.button('Undo',()=>P.run(e,async()=>{await undo();e.remove();})));document.body.append(e);setTimeout(()=>e.remove(),undo?10000:4000);};
  P.download=(name,body,type='text/plain')=>{const url=URL.createObjectURL(new Blob([body],{type})),a=P.el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  P.csv=rows=>rows.map(row=>row.map(value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');
  P.calendarFile=e=>{
    const escape=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const date=v=>P.date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Nu Alpha Phi//985//EN','BEGIN:VEVENT','UID:'+e.id+'@nualphaphi.com','DTSTAMP:'+date(Date.now()),'DTSTART:'+date(e.start),'DTEND:'+date(e.end||P.date(e.start).getTime()+3600000),'SUMMARY:'+escape(e.title),'DESCRIPTION:'+escape(e.description),'LOCATION:'+escape(e.locationTBD?'Location TBD':e.location),'BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:Event reminder','END:VALARM','END:VEVENT','END:VCALENDAR'];
    P.download('985-event.ics',lines.join('\r\n')+'\r\n','text/calendar');
  };
  P.eventTools=(e,root)=>{
    const row=P.row(P.button('Add to calendar / reminder',()=>P.calendarFile(e)),P.button('My ticket',()=>P.run(root,async()=>{
      const t=await P.call('eventTicket',{action:'issue',eventID:e.id}),box=P.el('div');
      const qr=qrcode(0,'M');qr.addData(t.code);qr.make();const image=P.el('img');image.alt='Your event admission QR ticket';image.src=qr.createDataURL(6,24);image.style.maxWidth='100%';box.append(image);
      box.append(P.el('h3','',t.title),P.el('p','',t.checkedInAt?'Already checked in':'Confirmed · party of '+(1+t.plusOneCount)),P.el('p','p-muted','Present this ticket code to the check-in team.'),P.el('code','p-text',t.code),P.button('Copy ticket',async()=>{await navigator.clipboard.writeText(t.code);P.toast('Ticket copied');}));P.dialog('Your ticket',box);
    })));
    root.append(row);
    P.call('eventTicket',{action:'capabilities',eventID:e.id}).then(cap=>{if(cap.canScan)row.append(P.button('Check-in desk',()=>P.checkin(e)));}).catch(err=>P.error(root,err));
    const remaining=P.date(e.deadline)-Date.now();
    root.append(P.el('p','p-muted',remaining>0?'RSVP closes in '+Math.ceil(remaining/3600000)+' hours':'RSVP deadline has passed'));
  };
  P.checkin=e=>{const box=P.el('div'),search=P.field('Search attendee','search'),code=P.field('Paste or scan ticket code'),list=P.el('div');let rows=[];
    const draw=()=>{list.replaceChildren();rows.filter(r=>(r.name+' '+r.realName+' '+r.chapter).toLowerCase().includes(search.input.value.toLowerCase())).forEach(r=>list.append(P.el('p','',r.name+' · '+r.realName+' · '+(1+r.plusOneCount)+' guests in party · '+(r.checkedInAt?'Checked in':'Awaiting arrival'))));};
    const load=async()=>{rows=(await P.call('eventTicket',{action:'roster',eventID:e.id})).rows;draw();};
    search.input.oninput=draw;box.append(code.wrap,P.button('Verify and check in',()=>P.run(box,async()=>{const r=await P.call('eventTicket',{action:'scan',eventID:e.id,code:code.input.value.trim()});P.toast(r.message);code.input.value='';await load();}),'p-btn primary'),search.wrap,P.button('Export attendee list',()=>P.download('attendees.csv',P.csv([['Name','Full name','Chapter','Party size','Checked in'],...rows.map(r=>[r.name,r.realName,r.chapter,1+r.plusOneCount,r.checkedInAt?P.when(r.checkedInAt):''])]),'text/csv')),list);const dialog=P.dialog(e.title+' · Check-in',box);P.run(box,load);
    if('BarcodeDetector' in window && navigator.mediaDevices){
      const camera=P.button('Scan with camera',()=>P.run(box,async()=>{
        const detector=new BarcodeDetector({formats:['qr_code']});camera.disabled=true;let stream;
        try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});}catch(error){camera.disabled=false;throw error;}
        if(!dialog.open){stream.getTracks().forEach(t=>t.stop());return;}
        const video=P.el('video');video.autoplay=true;video.playsInline=true;video.srcObject=stream;video.style.maxWidth='100%';box.prepend(video);let stopped=false;
        const stop=()=>{stopped=true;stream.getTracks().forEach(t=>t.stop());video.remove();camera.disabled=false;};dialog.addEventListener('close',stop,{once:true});
        await video.play().catch(error=>{stop();throw error;});
        const scan=async()=>{if(stopped)return;try{const results=await detector.detect(video);if(results.length){code.input.value=results[0].rawValue;stop();P.toast('Ticket scanned. Verify to check in.');return;}}catch(_){}setTimeout(scan,300);};scan();
      }));box.prepend(camera);
    }

  };
  P.renderCalendar=(root,events,date,onMove)=>{
    const year=date.getFullYear(),month=date.getMonth();
    root.append(P.row(P.button('← Previous',()=>onMove(new Date(year,month-1,1))),P.el('h2','',date.toLocaleDateString(undefined,{month:'long',year:'numeric'})),P.button('Next →',()=>onMove(new Date(year,month+1,1)))));
    const grid=P.el('div','p-calendar');['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(x=>grid.append(P.el('strong','',x)));
    for(let i=0;i<new Date(year,month,1).getDay();i++)grid.append(P.el('div'));
    for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
      const d=new Date(year,month,day),cell=P.el('div','p-calendar-day'+(d.toDateString()===new Date().toDateString()?' is-today':''));cell.append(P.el('span','',day));
      events.filter(e=>P.date(e.start).toDateString()===d.toDateString()).forEach(e=>cell.append(P.button(e.title,()=>P.openEvent(e.id))));grid.append(cell);
    }root.append(grid);
  };
  P.ready(()=>{
    const nav=P.el('nav','p-mobile-tabs');nav.setAttribute('aria-label','Primary navigation');
    [['home','Home'],['messages','Messages'],['events','Events'],['gallery','Gallery']].forEach(([id,label])=>{const b=P.button(label,()=>P.go(id));b.dataset.mobileTab=id;nav.append(b);});
    nav.append(P.button('More',()=>{const box=P.el('div');document.querySelectorAll('.portal-shell__nav-btn').forEach(b=>{if(b.hidden)return;box.append(P.button(b.textContent.trim(),()=>{d.close();b.click();},'p-search-result'));});const d=P.dialog('Explore 985',box);}));document.body.append(nav);
    const update=()=>nav.querySelectorAll('[data-mobile-tab]').forEach(b=>{if(location.hash==='#'+b.dataset.mobileTab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});document.addEventListener('nap:tab-changed',()=>setTimeout(update,0));update();
  });
})();
