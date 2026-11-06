(function () {
  "use strict";
  const P = P985;
  let classes = [],
    people = [],
    tree = [],
    links = {}, accountLinks = {},
    chapter = "",
    search = "",
    issuesOnly = false, viewMode = "classes";
  const expandedClasses = new Set();
  const loadedSources = new Set();
  P.rosterClassRoles = members => {
    const roles = new Map();
    if (members.length) roles.set(members[0].id, 'Captain');
    if (members.length > 1) roles.set(members[members.length - 1].id, 'Co-Captain');
    return roles;
  };
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const greek = [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
    "iota",
    "kappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "omicron",
    "pi",
    "rho",
    "sigma",
    "tau",
    "upsilon",
    "phi",
    "chi",
    "psi",
    "omega",
  ];
  const order = (s) =>
    String(s || "")
      .toLowerCase()
      .split(" ")
      .reduce((a, w) => a * 24 + greek.indexOf(w) + 1, 0);
  const classKey = value => norm(String(value || '').replace(/\s*class\s*$/i, ''));
  P.rosterClassCrossing = (c, records = tree) => {
    const nodes = records.filter(t => norm(t.chapter) === norm(c.chapter) && classKey(t.pledgeClass) === classKey(c.pledgeClass));
    const clean = (term, year) => {
      term = String(term || '').trim().toLowerCase();
      if (!['spring','summer','fall','winter'].includes(term) || !/^\d{4}$/.test(String(year || ''))) return '';
      return term[0].toUpperCase()+term.slice(1)+' '+year;
    };
    const dates = [...new Set(nodes.map(n=>clean(n.term,n.year)).filter(Boolean))];
    const saved = clean(c.semesterCrossed,c.yearCrossed);
    if(saved && !dates.includes(saved)) dates.push(saved);
    return {nodes, dates, missing:nodes.filter(n=>!clean(n.term,n.year)), label:dates.length===1?dates[0]:'', conflict:dates.length>1};
  };
  function setClassCrossing(c) {
    const form=P.el('div'), report=P.rosterClassCrossing(c);
    const term=P.select('Crossing Semester',['Spring','Summer','Fall','Winter'],report.label.split(' ')[0]||'Fall');
    const year=P.field('Crossing Year','number',report.label.split(' ')[1]||'');
    form.append(P.el('p','p-muted','Applies to every family-tree record in '+c.chapter+' · '+c.pledgeClass+' Class, and the master roster class.'),term.wrap,year.wrap);
    form.append(P.button('Save Class Crossing',()=>P.run(form,async()=>{
      if(!/^\d{4}$/.test(year.input.value)||Number(year.input.value)<1994||Number(year.input.value)>new Date().getFullYear()+1)throw Error('Enter a valid four-digit crossing year.');
      if(report.nodes.length>400)throw Error('This class is too large to update at once.');
      await db.runTransaction(async tx=>{
        const refs=report.nodes.map(n=>db.doc('familyTree/'+n.id));
        const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
        const classRef=db.doc('masterRosterClasses/'+c.id), classSnap=await tx.get(classRef);
        if(!classSnap.exists || classSnap.data().semesterCrossed!==c.semesterCrossed || classSnap.data().yearCrossed!==c.yearCrossed || norm(classSnap.data().chapter)!==norm(c.chapter) || classKey(classSnap.data().pledgeClass)!==classKey(c.pledgeClass))throw Error('The class changed. Reopen this editor.');
        snapshots.forEach((snap,i)=>{
          const old=report.nodes[i],now=snap.data();
          if(!snap.exists || now.term!==old.term || now.year!==old.year || norm(now.chapter)!==norm(c.chapter) || classKey(now.pledgeClass)!==classKey(c.pledgeClass))throw Error('A tree record changed. Reopen this editor before saving.');
        });
        refs.forEach(ref=>tx.update(ref,{term:term.input.value,year:Number(year.input.value)}));
        tx.update(classRef,{semesterCrossed:term.input.value,yearCrossed:Number(year.input.value)});
      });d.close();
    }),'p-btn primary'));
    const d=P.dialog('Class Crossing',form);
  }
  P.renderRosterDiscrepancies = content => {
    if(!P.me.isAdmin) return;
    if(loadedSources.size < 4) { content.append(P.empty('Loading roster and family-tree records…')); return; }
    content.append(P.el('p','p-muted','Review crossing dates and roster-to-tree differences. Dates are shared by the whole chapter pledge class; conflicting records are never chosen automatically.'));
    let count=0;
    classes.forEach(c=>{
      const report=P.rosterClassCrossing(c);
      if(!report.conflict && report.label && !report.missing.length) return;
      count++;
      const card=P.el('section','p-card p-crossing-review');
      card.append(P.el('h3','',c.chapter+' · '+c.pledgeClass+' Class'),P.el('p','p-muted',report.conflict?'Conflicting dates: '+report.dates.join(' / '):!report.label?'Crossing date not recorded':report.missing.length+' tree records missing a complete crossing date'));
      report.nodes.forEach(n=>card.append(P.el('p','p-crossing-record',(n.pledgeName||n.name||'Brother')+' · '+(n.name||'')+' — '+([n.term,n.year].filter(Boolean).join(' ')||'Not recorded'))));
      card.append(P.button('Set Class Crossing',()=>setClassCrossing(c)));content.append(card);
    });
    tree.filter(t=>!classes.some(c=>norm(c.chapter)===norm(t.chapter)&&classKey(c.pledgeClass)===classKey(t.pledgeClass))).forEach(t=>{
      count++;const card=P.el('div','p-card p-crossing-review');
      card.append(P.el('strong','',t.pledgeName||t.name||'Tree record'),P.el('p','p-muted','No matching roster class: '+(t.chapter||'Missing chapter')+' / '+(t.pledgeClass||'Missing class')),P.button('Review Tree Record',()=>window.napFocusFamilyMember(t.id)));content.append(card);
    });
    people.forEach(r=>{
      const c=classes.find(c=>c.id===r.classID), problem=c?issue(r,c):'Missing roster class';
      const duplicate=people.some(other=>other.id!==r.id && other.classID===r.classID && norm(other.fullName) && norm(other.fullName)===norm(r.fullName));
      if(!problem&&!duplicate) return;
      count++;const card=P.el('div','p-card p-crossing-review');
      card.append(P.el('strong','',(r.pledgeName||r.fullName)+' · '+(c?c.chapter+' / '+c.pledgeClass:'Unassigned')),P.el('p','p-muted',[problem,duplicate?'Duplicate roster identity':''].filter(Boolean).join(' · ')));
      card.append(P.button(c?'Compare Records':'Edit Entry',()=>c?compare(r,c):edit(r)));content.append(card);
    });
    if(!count)content.append(P.empty('No roster or crossing-date discrepancies found.'));
  };
  function candidates(r) {
    return tree.filter(
      (t) =>
        (norm(r.fullName) && norm(t.name) === norm(r.fullName)) ||
        (norm(r.pledgeName) && norm(t.pledgeName) === norm(r.pledgeName)),
    );
  }
  function issue(r, c) {
    const linked = links[r.id]?.treeID;
    const m = linked ? tree.filter(t => t.id === linked) : candidates(r);
    if (linked && !m.length) return "Linked family-tree record is missing";
    if (!m.length) return "Not in the family tree";
    if (m.length > 1) return "Multiple possible matches";
    const t = m[0];
    return norm(t.chapter) !== norm(c.chapter) ||
      norm(t.pledgeClass) !== norm(c.pledgeClass) ||
      norm(t.name) !== norm(r.fullName) ||
      norm(t.pledgeName) !== norm(r.pledgeName)
      ? "Details differ from family tree"
      : "";
  }
  function render() {
    const previous=P.rosterData;
    if(!previous || previous.classes!==classes || previous.people!==people || previous.tree!==tree || previous.links!==links || previous.accountLinks!==accountLinks){
      P.rosterData={classes,people,tree,links,accountLinks};
      document.dispatchEvent(new Event('p985:roster'));
    }
    const root = P.root("roster");
    root.replaceChildren(
      P.header(
        "Master Roster",
        people.length + " brothers · All chapters, with or without an account",
      ),
    );
    const canExport=P.me.isAdmin === true || [P.grant.role,...(P.grant.roles||[])].some(role=>['nationalBoard','president'].includes(role));
    const exportLabel=()=>viewMode==='classes'?'Export Roster':viewMode==='timeline'?'Export Timeline':'Export Statistics';
    let exportButton;
    if(canExport) {
      exportButton=P.button(exportLabel(),()=>P.run(root,async()=>{
        exportButton.disabled=true;exportButton.textContent='Preparing export…';
        try {await window.NAPRosterExport.download(viewMode==='classes'?undefined:viewMode);P.toast('Workbook downloaded. Open it in Excel or import it into Google Sheets.');}
        finally {exportButton.disabled=false;exportButton.textContent=exportLabel();}
      }),'p-btn');
      root.firstElementChild.append(exportButton);
    }
    const modes=P.el('div','p-roster-view-modes');modes.setAttribute('aria-label','Roster view');
    for(const [key,label] of [['classes','Class List'],['timeline','Crossing Timeline'],['statistics','Statistics']]){const b=P.button(label,()=>{if(viewMode===key)return;viewMode=key;for(const button of modes.children){const active=button===b;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}if(exportButton)exportButton.textContent=exportLabel();draw();},'p-btn'+(viewMode===key?' active':''));b.setAttribute('aria-pressed',String(viewMode===key));modes.append(b);}root.append(modes);
    const q = P.field("Search name or pledge name", "search", search),
      ch = P.select("Chapter", [["", "All chapters"], ...P.chapters], chapter);
    q.input.oninput = () => {
      search = q.input.value;
      draw();
    };
    ch.input.onchange = () => {
      chapter = ch.input.value;
      draw();
    };
    const filters=P.row(q.wrap,ch.wrap);filters.classList.add("p-roster-filters");root.append(filters);
    if (P.me.isAdmin)
      root.append(
        P.row(
          P.button("Add brother", () => edit()),
          P.button("Add class", () => editClass()),
          P.button('Review roster issues',()=>{
            const box=P.el('div'),duplicates=new Map();
            people.forEach(r=>{const key=r.classID+':'+norm(r.fullName);duplicates.set(key,[...(duplicates.get(key)||[]),r]);});
            const rows=people.filter(r=>{const c=classes.find(c=>c.id===r.classID);return !c||issue(r,c)||(duplicates.get(r.classID+':'+norm(r.fullName))||[]).length>1;});
            box.append(P.el('p','p-muted',rows.length+' entries need review. Review links individually; identities are never merged automatically.'));
            rows.forEach(r=>{const c=classes.find(c=>c.id===r.classID);const row=P.el('div','p-card');row.append(P.el('strong','',r.fullName+' · '+r.pledgeName),P.el('p','p-muted',!c?'Missing class':issue(r,c)||'Possible duplicate roster entry'));if(c)row.append(P.button('Compare records',()=>compare(r,c)));row.append(P.button('Edit entry',()=>edit(r)));box.append(row);});
            box.append(P.button('Export review list',()=>P.download('roster-review.csv',P.csv([['Full name','Pledge name','Class','Issue'],...rows.map(r=>{const c=classes.find(c=>c.id===r.classID);return [r.fullName,r.pledgeName,c?.pledgeClass||'',c?issue(r,c)||'Possible duplicate':'Missing class'];})]),'text/csv')));P.dialog('Roster review queue',box);
          }),
          P.button(
            issuesOnly ? "Show everyone" : "Review tree differences",
            () => {
              issuesOnly = !issuesOnly;
              render();
            },
          ),
        ),
      );
    const list = P.el("div", "p-roster-classes");
    root.append(list);
    const viewCache=new Map();let filterKey='';
    function draw() {
      const nextFilter=JSON.stringify([chapter,search,issuesOnly]);
      if(nextFilter!==filterKey){viewCache.clear();filterKey=nextFilter;}
      if(viewCache.has(viewMode)){list.replaceChildren(...viewCache.get(viewMode));return;}
      list.replaceChildren();
      if(viewMode!=='classes'){P.renderRosterMatrix(list,P.rosterData,viewMode,chapter,search);viewCache.set(viewMode,[...list.childNodes]);return;}
      const sorted = [...classes].sort(
        (a, b) =>
          P.chapters.indexOf(a.chapter) - P.chapters.indexOf(b.chapter) ||
          order(a.pledgeClass) - order(b.pledgeClass),
      );
      sorted
        .filter((c) => !chapter || c.chapter === chapter)
        .forEach((c) => {
          const roles = P.rosterClassRoles(people.filter(r => r.classID === c.id));
          const crossing = P.rosterClassCrossing(c);
          const members = people.filter(
            (r) =>
              r.classID === c.id &&
              (!search ||
                (r.fullName + " " + r.pledgeName)
                  .toLowerCase()
                  .includes(search.toLowerCase())) &&
              (!issuesOnly || issue(r, c)),
          );
          if (!members.length && !P.me.isAdmin) return;
          if (!members.length && (search || issuesOnly)) return;
          const group = P.el("details", "p-roster-group"), h=P.el("summary","p-roster-summary");
          group.open=!!search || expandedClasses.has(c.id);
          group.addEventListener("toggle",()=>{if(search)return;if(group.open)expandedClasses.add(c.id);else expandedClasses.delete(c.id);});
          const label=P.el("span","p-roster-class-label");label.append(P.el("small","",c.chapter+" Chapter"),P.el("strong","",c.pledgeClass+" Class"));
          label.append(P.el("small","p-roster-crossing",crossing.conflict?"Crossing date under review":crossing.label||"Crossing date not recorded"));
          h.append(label,P.el("span","p-roster-count",members.length+(members.length===1?" brother":" brothers")),P.el("span","p-roster-chevron","⌄"));
          if (P.me.isAdmin) {
            const actions=P.el("div","p-roster-class-actions");
            actions.append(P.button("Edit Class",()=>editClass(c)),P.button("Add Brother",()=>edit(null,c.id)));
            group.append(actions);
          }
          group.prepend(h);
          members.forEach((r) => {
            const row = P.el("div", "p-roster-person"),
              info = P.el("div");
            const account = P.brothers.filter(
              (b) =>
                norm(b.chapter) === norm(c.chapter) &&
                (norm(P.name(b)) === norm(r.pledgeName) ||
                  norm([b.firstName, b.lastName].join(" ")) ===
                    norm(r.fullName)),
            );
            const num =
              r.pledgeNumber ||
              (account.length === 1 ? account[0].pledgeNumber : "");
            info.append(
              P.button(
                r.pledgeName +
                  (num !== undefined && num !== "" ? " #" + num : ""),
                () =>
                  account.length === 1
                    ? P.profile(account[0].uid)
                    : P.profile('roster_'+r.id),
                "p-name",
              ),
              P.el("p", "p-muted", r.fullName),
            );
            if(crossing.label) info.append(P.el("small","p-roster-crossing","Crossed "+crossing.label));
            if (roles.has(r.id)) {
              const badge=P.el('span','p-roster-role',roles.get(r.id));
              badge.title=roles.get(r.id)+' of the pledge class';
              info.insertBefore(badge,info.querySelector('p'));
            }
            if (r.fallen)
              info.append(
                P.el("p", "", "Fallen Brother · May he rest in peace."),
              );
            if (r.disaffiliated)
              info.append(P.el("p", "", "Disaffiliated · Delettered"));
            if (P.me.isAdmin && links[r.id]?.treeID) info.append(P.el("small", "p-muted", "Family-tree match selected"));
            if (P.me.isAdmin && issue(r, c))
              info.append(P.el("small", "", issue(r, c)));
            row.append(info);
            if (P.me.isAdmin)
              row.append(
                P.row(
                  P.button("Edit", () => edit(r)),
                  P.button("Compare tree", () => compare(r, c)),
                ),
              );
            group.append(row);
          });
          list.append(group);
        });
      if (!list.children.length)
        list.append(P.empty("No brothers match your search."));
      viewCache.set(viewMode,[...list.childNodes]);
    }
    draw();
  }
  function editClass(c) {
    const form = P.el("div", "p-class-editor"),
      chapter = P.select("Chapter", P.chapters, c?.chapter || "Alpha"),
      name = P.field("Class", "text", c?.pledgeClass);
    const members=c?people.filter(r=>r.classID===c.id):[];
    const original=members.map(r=>r.id), ordering=P.el('div','p-class-order');
    function drawOrder(){
      ordering.replaceChildren();
      if(!c)return;
      ordering.append(P.el('h3','','Member Order'),P.el('p','p-muted','First is Captain. Last is Co-Captain. Changes apply when you save.'));
      ordering.append(P.button('+ Add Brother',()=>{
        const add=P.el('div','p-class-add-brother'),full=P.field('Full Name','text'),pledge=P.field('Pledge Name','text'),num=P.field('Number (optional)','text');
        full.input.maxLength=200;pledge.input.maxLength=100;num.input.maxLength=2;
        add.append(full.wrap,pledge.wrap,num.wrap,P.button('Add to Class',()=>P.run(add,async()=>{
          if(!full.input.value.trim()||!pledge.input.value.trim())throw Error('Enter both names.');
          if(!/^\d{0,2}$/.test(num.input.value))throw Error('Use up to two digits for the number.');
          if(members.length>=400)throw Error('This class has reached the editing limit.');
          members.push({id:crypto.randomUUID(),classID:c.id,fullName:full.input.value.trim(),pledgeName:pledge.input.value.trim(),pledgeNumber:num.input.value,fallen:false,disaffiliated:false,sourcePage:0,_new:true});drawOrder();
        }),'p-btn primary'),P.button('Cancel',()=>add.remove()));
        if(!ordering.querySelector('.p-class-add-brother')){ordering.append(add);full.input.focus();add.scrollIntoView({block:'nearest'});}
      }));
      members.forEach((r,i)=>{
        const row=P.el('div','p-class-order-row'), label=P.el('div');
        label.append(P.el('strong','',r.pledgeName),P.el('small','p-muted',r.fullName));
        const controls=P.el('div','p-class-order-controls');
        [-1,1].forEach(direction=>{const button=P.button(direction<0?'↑':'↓',()=>{[members[i],members[i+direction]]=[members[i+direction],members[i]];drawOrder();});button.disabled=i+direction<0||i+direction>=members.length;button.setAttribute('aria-label','Move '+r.pledgeName+(direction<0?' up':' down'));controls.append(button);});
        if(r._new){label.append(P.el('small','p-muted','New · saves with class'));controls.append(P.button('Remove',()=>{members.splice(i,1);drawOrder();}));}
        row.append(P.el('span','p-muted',String(i+1)),label,controls);ordering.append(row);
      });
    }
    drawOrder();
    form.append(
      chapter.wrap,
      name.wrap,
      ordering,
      P.button(
        "Save class",
        () =>
          P.run(form, async () => {
            if (!name.input.value.trim()) throw Error("Enter a class name.");
            if(!P.me.isAdmin)throw Error('Only administrators can edit the roster.');
            const batch=db.batch();
            batch.set(db.collection('masterRosterClasses').doc(c?.id||crypto.randomUUID()),{chapter:chapter.input.value,pledgeClass:name.input.value.trim()},{merge:true});
            if(members.length>400)throw Error('This class is too large to save at once.');
            if(members.some((r,i)=>r.id!==original[i]))members.forEach((r,i)=>{
              if(r._new){const {_new,id,...record}=r;batch.set(db.doc('masterRoster/'+r.id),{...record,sortOrder:i});}
              else batch.update(db.doc('masterRoster/'+r.id),{sortOrder:i});
            });
            await batch.commit();
            d.close();
          }),
        "p-btn primary",
      ),
    );
    if(c) form.append(P.button("Set Class Crossing",()=>setClassCrossing(c)));
    if (c)
      form.append(
        P.button(
          "Delete empty class",
          () =>
            P.run(form, async () => {
              if (people.some((r) => r.classID === c.id))
                throw Error(
                  "Move or remove all brothers before deleting this class.",
                );
              if (await P.confirm("Delete this empty class?")) {
                await db.doc("masterRosterClasses/" + c.id).delete();
                d.close();
              }
            }),
          "p-btn danger",
        ),
      );
    const d = P.dialog(c ? "Edit class" : "Add class", form);
  }
  P.editRosterEntry=(r)=>edit(r);
  function edit(r, defaultClassID) {
    const form = P.el("div"),
      full = P.field("Full real name", "text", r?.fullName),
      pledge = P.field("Pledge name", "text", r?.pledgeName),
      num = P.field("Pledge number (optional)", "text", r?.pledgeNumber),
      cls = P.select(
        "Chapter and class",
        classes.map((c) => [c.id, c.chapter + " · " + c.pledgeClass]),
        r?.classID || defaultClassID || classes[0]?.id,
      );
    num.input.pattern = "[0-9]{0,2}";
    num.input.maxLength = 2;
    form.append(full.wrap, pledge.wrap, num.wrap, cls.wrap);
    const details={};
    for(const [key,label] of [['bio','Bio'],['location','Location'],['occupation','Occupation'],['email','Email'],['phone','Phone'],['school', 'School'],['major', 'Major'],['educationStatus', 'Education'],['graduationYear', 'Graduation Year'],['birthday', 'Birthday'],['hometown', 'Hometown'],['instagramProfileURL', 'Instagram URL'],['facebookProfileURL', 'Facebook URL'],['linkedinProfileURL', 'LinkedIn URL'],['twitterProfileURL', 'X / Twitter URL']]){const f=P.field(label,key==='email'?'email':'text',r?.[key]||'');f.input.maxLength=key==='bio'?2000:200;details[key]=f.input;form.append(f.wrap);}

    const flags = {};
    for (const [key, label] of [
      ["fallen", "Fallen Brother"],
      ["disaffiliated", "Disaffiliated / Delettered"],
    ]) {
      const f = P.field(label, "checkbox");
      f.input.checked = !!r?.[key];
      flags[key] = f.input;
      form.append(f.wrap);
    }
    form.append(
      P.button(
        "Save brother",
        () =>
          P.run(form, async () => {
            if (!full.input.value.trim() || !pledge.input.value.trim())
              throw Error("Enter both names.");
            if (!/^\d{0,2}$/.test(num.input.value))
              throw Error("Use up to two digits for the pledge number.");
            await db
              .collection("masterRoster")
              .doc(r?.id || crypto.randomUUID())
              .set({
                ...Object.fromEntries(Object.entries(details).map(([key,input])=>[key,input.value.trim()])),
                fullName: full.input.value.trim(),
                pledgeName: pledge.input.value.trim(),
                pledgeNumber: num.input.value,
                classID: cls.input.value,
                fallen: flags.fallen.checked,
                disaffiliated: flags.disaffiliated.checked,
                sourcePage: r?.sourcePage || 0,
                sortOrder: r?.classID===cls.input.value && Number.isInteger(r.sortOrder) ? r.sortOrder : Math.max(-1,...people.filter(p=>p.classID===cls.input.value).map((p,i)=>Number.isInteger(p.sortOrder)?p.sortOrder:i))+1,
              });
            d.close();
          }),
        "p-btn primary",
      ),
    );
    if (r)
      form.append(
        P.button(
          "Remove from roster",
          () =>
            P.run(form, async () => {
              if (
                await P.confirm(
                  "Remove this roster entry? The account and family tree will remain.",
                )
              ) {
                await db.doc("masterRoster/" + r.id).delete();
                d.close();
              }
            }),
          "p-btn danger",
        ),
      );
    const d = P.dialog(r ? "Edit roster entry" : "Add brother", form);
  }
  function compare(r, c) {
    const box = P.el("div");
    box.append(
      P.el("h3", "", "Roster"),
      P.el(
        "p",
        "",
        r.fullName +
          " · " +
          r.pledgeName +
          " · " +
          c.chapter +
          " · " +
          c.pledgeClass,
      ),
      P.button("Edit roster entry", () => {
        d.close();
        edit(r);
      }),
    );
    const linkedID = links[r.id]?.treeID;
    const possible = candidates(r);
    const linked = tree.find(t => t.id === linkedID);
    if (linked && !possible.some(t => t.id === linked.id)) possible.unshift(linked);
    box.append(P.el("p", "p-muted", "Choose the family-tree record that belongs to this brother. Your selection is saved; no names or family connections are changed."));
    async function saveLink(treeID) {
      await db.runTransaction(async tx => {
        const ref = db.doc("rosterTreeLinks/" + r.id);
        const latest = await tx.get(ref);
        if ((latest.data()?.treeID || "") !== (linkedID || "")) throw Error("Another admin changed this match. Close and reopen Compare tree to review it.");
        if (treeID) tx.set(ref,{treeID,updatedBy:P.uid,updatedAt:P.stamp()});
        else tx.delete(ref);
      });
      if (treeID) links[r.id] = {treeID}; else delete links[r.id];
      d.close(); render(); compare(r,c);
    }
    if (linkedID) box.append(P.button("Clear selected match", () => P.run(box, () => saveLink(""))));
    box.append(P.el("h3", "", "Family tree"));
    if (!possible.length)
      box.append(
        P.empty(
          "No matching name or pledge name. Add a record in Family Tree.",
        ),
      );
    possible.forEach((t) => {
      const card = P.el("div", "p-card");
      card.append(
        P.el(
          "p",
          "",
          t.name +
            " · " +
            t.pledgeName +
            " · " +
            t.chapter +
            " · " +
            t.pledgeClass,
        ),
        P.button("Edit tree entry", () => {
          const form = P.el("div"),
            fields = {};
          for (const key of ["name", "pledgeName", "chapter", "pledgeClass"]) {
            const f =
              key === "chapter"
                ? P.select("Chapter", P.chapters, t[key])
                : P.field(key, "text", t[key]);
            fields[key] = f.input;
            form.append(f.wrap);
          }
          form.append(
            P.button(
              "Save tree identity",
              () =>
                P.run(form, async () => {
                  const data = Object.fromEntries(
                    Object.entries(fields).map(([k, v]) => [k, v.value.trim()]),
                  );
                  if (Object.values(data).some((v) => !v))
                    throw Error("Complete all fields.");
                  await db.doc("familyTree/" + t.id).update(data);
                  editor.close();
                  d.close();
                }),
              "p-btn primary",
            ),
          );
          const editor = P.dialog("Edit family tree entry", form);
        }),
      );
      const select = P.button(t.id === linkedID ? "Linked to this record" : "Link this record", () => P.run(card, async () => {
        select.disabled = true;
        try {await saveLink(t.id);} finally {select.disabled = false;}
      }), t.id === linkedID ? "p-btn" : "p-btn primary");
      select.disabled = t.id === linkedID;
      card.append(select);
      if (t.id === linkedID) card.classList.add("p-roster-linked");
      box.append(card);
    });
    const d = P.dialog("Compare records", box);
  }
  P.ready(() => {
    P.watch(db.collection('rosterAccountLinks'),rows=>{accountLinks=Object.fromEntries(rows.map(r=>[r.id,r]));render();},P.root('roster'));
    P.watch(db.collection("rosterTreeLinks"), rows => { loadedSources.add("links"); links = Object.fromEntries(rows.map(r => [r.id,r])); render(); }, P.root("roster"));
    P.watch(
      db.collection("masterRosterClasses"),
      (r) => {
        loadedSources.add("classes"); classes = r;
        render();
      },
      P.root("roster"),
    );
    P.watch(
      db.collection("masterRoster"),
      (r) => {
        loadedSources.add("people"); people = r.map((p,i)=>({...p,_initialOrder:i})).sort((a,b)=>(a.sortOrder??a._initialOrder)-(b.sortOrder??b._initialOrder));
        render();
      },
      P.root("roster"),
    );
    P.watch(
      db.collection("familyTree"),
      (r) => {
        loadedSources.add("tree"); tree = r;
        render();
      },
      P.root("roster"),
    );
  });
  document.addEventListener("p985:access",()=>{if(P.uid)render();});
  document.addEventListener("p985:people", () => {
    if (P.uid) render();
  });
})();
