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
  return {chapter:c.chapter,className:clean(c.pledgeClass),values:[c.chapter,clean(c.pledgeClass),String(r.pledgeName||''),first,last,term,year?Number(year):''],index,sortOrder:r.sortOrder};
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
 CHAPTERS.forEach((chapter,i)=>{cell(top,9+i,2,chapter);cell(top,9+i,3,{formula:`COUNTIF('Roster Check'!A:A,B${9+i})`,result:prepared.rows.filter(r=>r.chapter===chapter).length});});
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
  entries.forEach((r,i)=>r.values.forEach((v,j)=>cell(ws,i+2,j+1,v,j===2)));
  ws.autoFilter={from:'A1',to:'G'+Math.max(1,entries.length+1)};ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'};
 }
 rosterSheet('Roster Check',prepared.rows);rosterSheet('Founders',prepared.rows.filter(r=>norm(r.className)==='alpha'));
 CHAPTERS.forEach(ch=>rosterSheet(ch,prepared.rows.filter(r=>r.chapter===ch)));
 return book;
}
let loading;
async function library(){if(window.ExcelJS)return window.ExcelJS;if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/exceljs/exceljs.min.js?v=4.4.0';script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{script.remove();reject(Error('Could not load the exporter. Try again.'));};document.head.append(script);}).catch(e=>{loading=null;throw e;});return loading;}
async function download(){
 const uid=auth.currentUser?.uid;if(!uid)throw Error('Sign in first.');
 const data=await P985.call('rosterExport',{}),ExcelJS=await library(),book=build(ExcelJS,data),buffer=await book.xlsx.writeBuffer();
 await P985.call('rosterExport',{authorizeOnly:true});if(auth.currentUser?.uid!==uid)throw Error('Your account changed. Please try again.');
 const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download='Nu-Alpha-Phi-Master-Roster-'+data.generatedAt.slice(0,10)+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
return {CHAPTERS,rows,build,download};
});
