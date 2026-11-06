/* On-demand roster workbook. Data and permission are checked by rosterExport. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NAPRosterExport=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const CHAPTERS=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa'];
const GREEK=['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega'];
const clean=s=>String(s||'').trim().replace(/\s+class$/i,'').trim();
const norm=s=>clean(s).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
const order=s=>norm(s).split(' ').reduce((a,w)=>a*24+GREEK.indexOf(w)+1,0);
const border={top:{style:'thin',color:{argb:'FF111111'}},bottom:{style:'thin',color:{argb:'FF111111'}},left:{style:'thin',color:{argb:'FF111111'}},right:{style:'thin',color:{argb:'FF111111'}}};
function names(person){return [person?.firstName,person?.middleName].filter(Boolean).join(' ');}
function rows(data){
 const classes=new Map(data.classes.map(c=>[c.id,c])), warnings=[];
 const classDates=new Map(data.classes.map(c=>{
  const candidates=data.tree.filter(t=>norm(t.chapter)===norm(c.chapter)&&norm(t.pledgeClass)===norm(c.pledgeClass));
  const values=[...candidates.map(t=>[t.term,t.year]),[c.semesterCrossed,c.yearCrossed]];
  const dates=[...new Set(values.filter(([t,y])=>/^(spring|summer|fall|winter)$/i.test(String(t))&&/^\d{4}$/.test(String(y))).map(([t,y])=>String(t)[0].toUpperCase()+String(t).slice(1).toLowerCase()+' '+y))];
  if(dates.length!==1)warnings.push(c.chapter+' / '+clean(c.pledgeClass)+': '+(dates.length?'conflicting crossing dates':'crossing date missing'));
  return [c.id,dates.length===1?dates[0].split(' '):['','']];
 }));
 const output=data.people.map((r,index)=>{
  const c=classes.get(r.classID);if(!c||!CHAPTERS.includes(c.chapter))throw Error('A roster entry has no valid chapter/class. Fix Roster discrepancies before exporting.');
  const accountLink=(data.accountLinks||[]).find(l=>l.rosterID===r.id);
  const matched=accountLink?(data.brothers||[]).filter(b=>b.id===accountLink.id):(data.brothers||[]).filter(b=>norm(b.chapter)===norm(c.chapter)&&norm([b.firstName,b.middleName,b.lastName].filter(Boolean).join(' '))===norm(r.fullName));
  let first,last;
  if(r.firstName&&r.lastName){first=r.firstName;last=r.lastName;}
  else if(matched.length===1&&matched[0].lastName){first=names(matched[0]);last=matched[0].lastName;}
  else {const parts=String(r.fullName||'').trim().split(/\s+/);last=parts.length>1?parts.pop():'';first=parts.join(' ');}
  const [term,year]=classDates.get(c.id);
  return {chapter:c.chapter,className:clean(c.pledgeClass),values:[c.chapter,clean(c.pledgeClass),String(r.pledgeName||''),first,last,term,year?Number(year):''],index,fallen:r.fallen===true,disaffiliated:r.disaffiliated===true,sortOrder:r.sortOrder};
 });
 output.sort((a,b)=>CHAPTERS.indexOf(a.chapter)-CHAPTERS.indexOf(b.chapter)||order(a.className)-order(b.className)||a.className.localeCompare(b.className)||(a.sortOrder??a.index)-(b.sortOrder??b.index));
 return {rows:output,warnings};
}
function build(ExcelJS,data){
 const prepared=rows(data),book=new ExcelJS.Workbook(),date=new Date(data.generatedAt||Date.now());
 book.creator='Nu Alpha Phi';book.created=date;book.calcProperties.fullCalcOnLoad=true;
 const top=book.addWorksheet('Top Sheet',{views:[{showGridLines:false,zoomScale:80}]});
 top.columns=[{width:3},{width:20},{width:34},{width:6},{width:15},{width:16},{width:24},{width:24},{width:23},{width:23},{width:24}];
 function cell(ws,row,col,value,bold=false,fill){const c=ws.getCell(row,col);c.value=value;c.font={name:'Arial',size:12,bold};c.alignment={vertical:'middle',wrapText:true};c.border=border;if(fill)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+fill}};return c;}
 function merged(ws,r,c1,c2,value){ws.mergeCells(r,c1,r,c2);const c=cell(ws,r,c1,value,true);c.alignment={horizontal:'center',vertical:'middle'};return c;}
 merged(top,3,2,3,'LAST UPDATED BY…');
 cell(top,4,2,'DATE:',true);cell(top,4,3,date.toLocaleDateString('en-US',{timeZone:'America/New_York'}));
 const e=data.exporter||{};cell(top,5,2,'BROTHER:',true);cell(top,5,3,[e.firstName,e.pledgeName?'“'+e.pledgeName+'”':'',e.lastName].filter(Boolean).join(' '));
 merged(top,8,2,3,'BROTHER COUNTS');
 CHAPTERS.forEach((chapter,i)=>{cell(top,9+i,2,chapter);cell(top,9+i,3,{formula:`ROWS('${chapter}'!A1:A${prepared.rows.filter(r=>r.chapter===chapter).length+1})-1`,result:prepared.rows.filter(r=>r.chapter===chapter).length});});
 cell(top,19,2,'ΝΑΦ',true,'8B0000').font={name:'Arial',size:12,bold:true,color:{argb:'FFFFFFFF'}};
 cell(top,19,3,{formula:'SUM(C9:C18)',result:prepared.rows.length},true,'8B0000').font={name:'Arial',size:12,bold:true,color:{argb:'FFFFFFFF'}};
 ['', 'Chapter','Class','Pledge Name','First','Last','Contact'].forEach((v,i)=>cell(top,3,5+i,v,true));
 function contact(row,label,uid,color){const person=(data.contacts||[]).find(p=>p.id===uid);const values=[label,person?.chapter||'',clean(person?.pledgeClass),person?.pledgeName||'Not assigned',names(person),person?.lastName||'',person?.phone||''];values.forEach((v,i)=>cell(top,row,5+i,v,i===0||i===3,i>0?color:undefined));}
 contact(4,'Warden',data.slots?.warden,'70AD47');
 CHAPTERS.forEach((ch,i)=>{const row=5+i*2;contact(row,ch,data.slots?.['master-'+ch+'-1'],'FFDD66');contact(row+1,'',data.slots?.['master-'+ch+'-2'],'FFDD66');top.mergeCells(row,5,row+1,5);top.getCell(row,5).alignment={vertical:'middle',horizontal:'center'};});
 for(let r=3;r<=24;r++)top.getRow(r).height=26;top.getRow(5).height=34;
 top.mergeCells('B27:K27');top.getCell('B27').value='Current export snapshot · Contacts: national pledge warden and chapter pledge masters · Unassigned contacts remain blank.';top.getCell('B27').font={name:'Arial',size:10,color:{argb:'FF666666'}};
 top.mergeCells('B28:K28');top.getCell('B28').value='Names use linked account fields when available; otherwise the last word of the roster name is placed in Last Name. Review compound surnames.';top.getCell('B28').font={name:'Arial',size:10,color:{argb:'FF666666'}};
 prepared.warnings.forEach((warning,i)=>{top.mergeCells(30+i,2,30+i,11);top.getCell(30+i,2).value=warning;top.getCell(30+i,2).font={name:'Arial',size:10,color:{argb:'FF9C0006'}};});
 top.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
 function rosterSheet(name,entries){
  const ws=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1,showGridLines:false}],properties:{defaultRowHeight:23}});
  ws.columns=[22,24,28,25,25,20,14].map(width=>({width}));
  ['CHAPTER','CLASS','PLEDGE NAME','FIRST NAME','LAST NAME','SEMESTER','YEAR'].forEach((v,i)=>{const c=cell(ws,1,i+1,v,true);c.alignment={horizontal:'center',vertical:'middle'};});ws.getRow(1).height=28;
  entries.forEach((r,i)=>r.values.forEach((v,j)=>{
   const c=cell(ws,i+2,j+1,v,j===2||r.disaffiliated,r.disaffiliated?'000000':r.fallen?'8B0000':undefined);
   if(r.disaffiliated){c.font={name:'Arial',size:12,bold:true,color:{argb:'FF000000'}};c.alignment={horizontal:'center',vertical:'middle'};}
   else if(r.fallen)c.font={name:'Arial',size:12,bold:j===2,color:{argb:'FFFFFFFF'}};
  }));
  if(entries.some(r=>r.disaffiliated)){
   ws.getColumn(8).width=24;cell(ws,1,8,'STATUS',true);
   entries.forEach((r,i)=>{if(r.disaffiliated){const c=cell(ws,i+2,8,'DISAFFILIATED',true,'000000');c.font={name:'Arial',size:12,bold:true,color:{argb:'FFFFFFFF'}};}});
  }
  ws.autoFilter={from:'A1',to:'G'+Math.max(1,entries.length+1)};ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'};
 }
 rosterSheet('Roster Check',prepared.rows);rosterSheet('Founders',prepared.rows.filter(r=>norm(r.className)==='alpha'));
 CHAPTERS.forEach(ch=>rosterSheet(ch,prepared.rows.filter(r=>r.chapter===ch)));
 return book;
}
const COLORS=['E60000','FFD400','008018','3366FF','999999','993366','FF7800','FFD09A','993300','00DBDF'];
function matrix(data){
 const prepared=rows(data),groups=new Map(),years=prepared.rows.map(r=>Number(r.values[6])).filter(y=>y>=1994&&y<=2100);
 const end=Math.max(new Date(data.generatedAt||Date.now()).getFullYear(),...years),terms=prepared.rows.some(r=>r.values[5]==='Winter')?['Winter','Spring','Summer','Fall']:['Spring','Summer','Fall'];
 const periods=[];for(let year=1994;year<=end;year++)for(const term of terms)periods.push({year,term,key:year+' '+term});
 for(const r of prepared.rows){const key=r.values[6]&&r.values[5]?r.values[6]+' '+r.values[5]:'review';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 if(groups.has('review'))periods.push({year:'—',term:'Needs review',key:'review'});
 return {periods:periods.map(p=>({...p,entries:groups.get(p.key)||[],counts:CHAPTERS.map(ch=>(groups.get(p.key)||[]).filter(r=>r.chapter===ch).length)})),totals:CHAPTERS.map(ch=>prepared.rows.filter(r=>r.chapter===ch).length),total:prepared.rows.length,warnings:prepared.warnings};
}
function buildView(ExcelJS,data,mode){
 const m=matrix(data),book=new ExcelJS.Workbook(),stats=mode==='statistics',ws=book.addWorksheet(stats?'Crossing Statistics':'Crossing Timeline',{views:[{state:'frozen',xSplit:stats?3:2,ySplit:stats?2:1,showGridLines:false}]});
 ws.columns=[{width:10},{width:18},...(stats?[{width:12}]:[]),...CHAPTERS.map(()=>({width:stats?15:36}))];
 const offset=stats?4:3;
 function style(cell,bg='FFFFFF',fg='111111',bold=false){cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+bg}};cell.font={name:'Arial',size:11,bold,color:{argb:'FF'+fg}};cell.border=border;cell.alignment={vertical:'top',wrapText:true};}
 ['Year','Semester',...(stats?['Total']:[]),...CHAPTERS.map(c=>c.toUpperCase())].forEach((v,i)=>{const cell=ws.getCell(1,i+1);cell.value=v;style(cell,i+1>=offset?COLORS[i+1-offset]:'20202A',i+1>=offset?'000000':'FFFFFF',true);});ws.getRow(1).height=32;
 if(stats){ws.getCell('B2').value='Total';ws.getCell('C2').value=m.total;m.totals.forEach((v,i)=>ws.getCell(2,i+offset).value=v);for(let col=1;col<=13;col++)style(ws.getCell(2,col),'8B0000','FFFFFF',true);}
 m.periods.forEach((p,index)=>{
  const row=index+(stats?3:2);ws.getCell(row,1).value=p.year;ws.getCell(row,2).value=p.term;style(ws.getCell(row,1));style(ws.getCell(row,2));if(stats){ws.getCell(row,3).value=p.entries.length;style(ws.getCell(row,3),'E8E8EC','111111',true);}
  let height=24;
  CHAPTERS.forEach((ch,i)=>{const cell=ws.getCell(row,i+offset),entries=p.entries.filter(e=>e.chapter===ch);
   if(stats){cell.value=entries.length;style(cell,entries.length?'8B0000':Number(p.year)%2?'FFFFFF':'E8E8EC',entries.length?'FFFFFF':'111111',!!entries.length);return;}
   if(!entries.length){style(cell,'000000');return;}
   const runs=[];let cls='';entries.forEach(e=>{if(e.className!==cls){cls=e.className;runs.push({text:(runs.length?'\n':'')+cls.toUpperCase()+' CLASS\n',font:{bold:true}});}runs.push({text:e.values[2]+' – '+[e.values[3],e.values[4]].filter(Boolean).join(' ')+(e.disaffiliated?' · DISAFFILIATED':e.fallen?' · RIP':'')+'\n',font:{color:{argb:e.disaffiliated?'FF777777':e.fallen?'FFB00020':'FF111111'}}});});
   cell.value={richText:runs};style(cell);height=Math.max(height,Math.min(409,18*(entries.length+new Set(entries.map(e=>e.className)).size+1)));});ws.getRow(row).height=height;
 });
 ws.pageSetup={orientation:'landscape',paperSize:3,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:stats?'1:2':'1:1'};
 return book;
}

let loading;
async function library(){if(window.ExcelJS)return window.ExcelJS;if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/exceljs/exceljs.min.js?v=4.4.0';script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{script.remove();reject(Error('Could not load the exporter. Try again.'));};document.head.append(script);}).catch(e=>{loading=null;throw e;});return loading;}
async function download(mode){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sign in first.');
 const data=await P985.call('rosterExport',{}),ExcelJS=await library(),book=mode?buildView(ExcelJS,data,mode):build(ExcelJS,data),buffer=await book.xlsx.writeBuffer();
 await P985.call('rosterExport',{authorizeOnly:true});if(auth.currentUser?.uid!==uid)throw Error('Your account changed. Please try again.');
 const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download='Nu-Alpha-Phi-'+(mode||'Master-Roster')+'-'+data.generatedAt.slice(0,10)+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
return {CHAPTERS,COLORS,rows,matrix,build,buildView,download};
});
