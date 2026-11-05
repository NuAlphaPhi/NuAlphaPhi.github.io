/* Browser-side XLSX export. Only the authenticated tree snapshot is exported. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NAPFamilyTreeExport = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  // Match the chapter legend in the supplied spreadsheet reference.
  const COLORS = {Alpha:'E60000',Beta:'FFD600',Gamma:'008A18',Delta:'3662FF',Epsilon:'A6A6A6',Zeta:'963565',Eta:'FF7900',Theta:'FFCB95',Iota:'A13D00',Kappa:'00D8DE'};
  const text = value => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
  const name = member => member.pledgeName || member.name || 'Unnamed brother';
  function note(member, missingBig) {
    return ['Pledge name: '+text(member.pledgeName),'Real name: '+text(member.name),'Chapter: '+text(member.chapter),'Class: '+text(member.pledgeClass),'Crossed: '+(member.term || member.year ? [member.term, member.year].filter(Boolean).join(' ') : 'Not recorded'), ...(missingBig ? ['Big’s record is missing from the family tree.'] : [])].join('\n');
  }
  function layout(members) {
    if (!members.length) throw Error('There are no brothers in the family tree to export yet.');
    const byId = new Map(), children = new Map(), positions = new Map();
    for (const member of members) {
      if (!member.id || byId.has(member.id)) throw Error('The family tree contains a missing or duplicate record ID. Ask an administrator to review it.');
      byId.set(member.id, member); children.set(member.id, []);
    }
    // Reject loops explicitly instead of silently dropping a branch or freezing.
    const finished = new Set();
    for (const member of members) {
      let next = member; const path = new Set();
      while (next && !finished.has(next.id)) {
        if (path.has(next.id)) throw Error('A circular big/little link was found near '+name(next)+'. Ask an administrator to fix it before exporting.');
        path.add(next.id); next = byId.get(next.bigId);
      }
      for (const id of path) finished.add(id);
    }
    const roots = [];
    for (const member of members) {
      if (byId.has(member.bigId)) children.get(member.bigId).push(member);
      else roots.push(member);
    }
    const terms = {spring:0,summer:1,fall:2,winter:3};
    const compare = (a,b) => (Number(a.year)||9999)-(Number(b.year)||9999) || (terms[String(a.term).toLowerCase()]??4)-(terms[String(b.term).toLowerCase()]??4) || name(a).localeCompare(name(b)) || a.id.localeCompare(b.id);
    roots.sort(compare); children.forEach(list => list.sort(compare));
    const stack = roots.map(member => ({member,depth:0,newBranch:true})).reverse();
    let row = 4, maxColumn = 10;
    while (stack.length) {
      const {member,depth,newBranch} = stack.pop();
      if (newBranch) row += 2;
      if (depth >= 16384 || row > 1048576) throw Error('This tree exceeds the worksheet size limit.');
      positions.set(member.id, {row,column:depth+1,member}); maxColumn = Math.max(maxColumn,depth+1);
      const kids = children.get(member.id);
      for (let i=kids.length-1;i>=0;i--) stack.push({member:kids[i],depth:depth+1,newBranch:i>0});
    }
    return {positions,byId,children,rows:row,columns:maxColumn};
  }
  function foreground(hex) {
    const linear = [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722 > .179 ? 'FF111111' : 'FFFFFFFF';
  }
  function build(ExcelJS, members, generated = new Date()) {
    const tree = layout(members), workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nu Alpha Phi'; workbook.created = generated;
    const sheet = workbook.addWorksheet('Family Tree', {views:[{state:'frozen',ySplit:4,zoomScale:80}],properties:{defaultRowHeight:22}});
    for(let column=1;column<=tree.columns;column++) sheet.getColumn(column).width=24;
    sheet.mergeCells('A1:J1'); sheet.getCell('A1').value='NU ALPHA PHI · FAMILY TREE';
    sheet.getCell('A1').font={name:'Calibri',size:18,bold:true,color:{argb:'FF56162E'}};sheet.getRow(1).height=34;
    sheet.mergeCells('A2:J2');sheet.getCell('A2').value=members.length+' brothers · Exported '+generated.toISOString().slice(0,10)+' · Generations run left to right. Cell notes contain brother details.';
    sheet.getCell('A2').font={name:'Calibri',size:11,color:{argb:'FF555555'}};sheet.getRow(2).height=26;
    Object.entries(COLORS).forEach(([chapter,color],index)=>{
      const cell=sheet.getCell(3,index+1);cell.value=chapter.toUpperCase();cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+color}};
      cell.font={name:'Calibri',bold:true,size:12,color:{argb:foreground(color)}};cell.alignment={horizontal:'center',vertical:'middle'};
    });sheet.getRow(3).height=26;
    for(const {member,row,column} of tree.positions.values()) {
      const cell=sheet.getCell(row,column),color=COLORS[member.chapter]||'D1D5DB';
      cell.value=String(name(member));cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+color}};
      cell.font={name:'Calibri',size:12,bold:true,color:{argb:foreground(color)}};
      cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};sheet.getRow(row).height=34;
      cell.note=note(member,member.bigId&&!tree.byId.has(member.bigId));
    }
    // Adjacent cells form the first branch; a colored left border joins each
    // additional little to the same big, matching the reference sheet.
    for(const {member,row,column} of tree.positions.values()) {
      const kids=tree.children.get(member.id);if(kids.length<2)continue;
      const lastRow=tree.positions.get(kids[kids.length-1].id).row;
      for(let branchRow=row+1;branchRow<=lastRow;branchRow++) {
        const cell=sheet.getCell(branchRow,column+1);
        cell.border={...cell.border,left:{style:'medium',color:{argb:'FF'+(COLORS[member.chapter]||'777777')}}};
      }
    }
    sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
    return workbook;
  }
  let loading;
  function loadLibrary() {
    if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
    if(!loading)loading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/vendor/exceljs/exceljs.min.js?v=4.4.0';
      script.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(Error('The spreadsheet exporter could not start.'));
      script.onerror=()=>{script.remove();reject(Error('Could not load the spreadsheet exporter. Please try again.'));};document.head.append(script);
    }).catch(error=>{loading=null;throw error;});return loading;
  }
  async function requireAdmin(expectedUid) {
    const uid = typeof auth !== 'undefined' && auth.currentUser?.uid;
    if (!uid || (expectedUid && uid !== expectedUid)) throw Error('Only administrators can export the family tree.');
    // Read the current server record, not a cached profile or hidden-button state.
    const snapshot = await db.doc('users/' + uid).get({source:'server'});
    const profile = snapshot.exists && snapshot.data();
    if (!profile || profile.isAdmin !== true || profile.disabled === true || (profile.membershipStatus && profile.membershipStatus !== 'approved') || auth.currentUser?.uid !== uid) {
      throw Error('Only administrators can export the family tree.');
    }
    return uid;
  }
  async function download(members) {
    const uid = await requireAdmin();
    const snapshot=members.map(member=>({...member}));
    layout(snapshot); // Validate before loading the optional library.
    const ExcelJS=await loadLibrary(),generated=new Date();
    const buffer=await build(ExcelJS,snapshot,generated).xlsx.writeBuffer();
    await requireAdmin(uid);
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='Nu-Alpha-Phi-Family-Tree-'+generated.toISOString().slice(0,10)+'.xlsx';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  return {COLORS,layout,note,build,download};
});
