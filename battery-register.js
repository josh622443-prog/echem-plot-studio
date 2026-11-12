/* Battery register: local-only, one row per imported file. */
(() => {
const fields = ['Fabrication date','Cell number','Current collector','Temperature','Ag-C Ratio','Pressure mode','Cathode mass (mg)','AgC mass (mg)','Ag mass (mg)','Cat mass-AgC mass','Pre-Densification Step 1 (Pressure)','Pre-Densification Step 1 (Temperature)','Final Densification Step 2 (Pressure)','Final Densification Step 2 (Temperature)','Cathode predensification','OCV (before pressed)','OCV (after pressed)','R_bulk','1st S. Dis. Cap. (mAh/g)','ICE (%)','Last recorded cycle','Retention (%)','CE@C/3 (%)','Avg. Eff. CE (%)','Status','Charge and Discharge step','Link','Comment','Channel','Mirror plate','Filename pressure (MPa)','Source file','Analysis sheet','Reference cycle','Last discharge cycle','Discharge capacity unit','Review notes'];
const number = x => x === null || x === undefined || String(x).trim()==='' ? null : Number.isFinite(Number(x)) ? Number(x) : null;
const norm = x => String(x).toLowerCase().replace(/[\s_.()\/\-]/g,'');
function capacityUnit(h){
 const s=String(h).toLowerCase().replace(/\s/g,'');
 if(/mah\/g|mah·g|mahg[-−]1/.test(s)) return {unit:'mAh/g',scale:1};
 if(/ah\/kg/.test(s)) return {unit:'mAh/g',scale:1};
 if(/ah\/g/.test(s)) return {unit:'mAh/g',scale:1000};
 if(/mah/.test(s)) return {unit:'mAh',scale:1};
 if(/ah/.test(s)) return {unit:'mAh',scale:1000};
 return null;
}
function direction(h, discharge){return discharge ? /discharge|dchg|dch|放电|放電/i.test(h) : !/discharge|dchg|dch|放电|放電/i.test(h)&&/charge|chg|充电|充電/i.test(h);}
function analyze(b){
 const row=Object.fromEntries(fields.map(f=>[f,''])), notes=[];
 row['Cell number']=b.name; row['Source file']=b.sourceName||b.name;
 row.Status=b.status; row['Review notes']='';
 const pressure=(b.sourceName||b.name).match(/(\d+(?:[._]\d+)?)\s*MPa\b/i);
 if(pressure){row['Filename pressure (MPa)']=Number(pressure[1].replace('_','.')); notes.push('Pressure inferred from filename; process stage unconfirmed');}
 if(b.status!=='loaded'){notes.push(b.error||'Not a successfully imported experimental file');row['Review notes']=notes.join('; ');return {row,cycles:[]};}
 let candidates=Object.entries(b.sheets||{}).map(([name,s])=>({name,s,cycle:(s.headers||[]).find(h=>/^(cycleindex|cyclenumber|cycle|循环序号|循環序號|循环号|圈数)$/.test(norm(h)))})).filter(x=>x.cycle);
 // Prefer explicit one-row-per-cycle tables; otherwise use record data.
 candidates.sort((a,z)=>(/cycle|summary|循环|循環/i.test(z.name)?1:0)-(/cycle|summary|循环|循環/i.test(a.name)?1:0));
 let chosen;
 for(const c of candidates){if((c.s.headers||[]).some(h=>/cap|容量/i.test(h)&&capacityUnit(h))){chosen=c;break;}}
 if(!chosen){notes.push('Cycle / capacity columns with explicit units not found');row['Review notes']=notes.join('; ');return {row,cycles:[]};}
 const {name,s,cycle}=chosen, hs=s.headers;
 row['Analysis sheet']=name;
 const caps=hs.filter(h=>/cap|容量/i.test(h)&&capacityUnit(h));
 const select=dis=>caps.find(h=>direction(h,dis)&&capacityUnit(h).unit==='mAh/g')||caps.find(h=>direction(h,dis));
 const dc=select(true), cc=select(false), generic=caps.find(h=>!direction(h,true)&&!direction(h,false));
 const current=hs.find(h=>/^(current|电流|電流)/i.test(h));
 const step=hs.find(h=>/step.*(type|status)|工步.*类型|工步.*類型|状态|狀態/i.test(h));
 const mass=number(b.sourceMassG);
 const target=dc?capacityUnit(dc).unit:generic?capacityUnit(generic).unit:cc?capacityUnit(cc).unit:null;
 const outUnit=target==='mAh'&&mass>0?'mAh/g':target;
 row['Discharge capacity unit']=outUnit||'';
 function val(r,h){const v=number(r[h]);if(v===null||v<0)return null;const u=capacityUnit(h);let n=v*u.scale;if(u.unit!==target)return null;if(target==='mAh'&&mass>0)n/=mass;return n;}
 const groups=new Map();
 for(const r of s.rows){const cy=number(r[cycle]);if(cy===null)continue;let g=groups.get(cy);if(!g){g={cycle:cy,charge:null,discharge:null};groups.set(cy,g);}
  for(const [h,k] of [[dc,'discharge'],[cc,'charge']])if(h){const v=val(r,h);if(v!==null)g[k]=g[k]===null?v:Math.max(g[k],v);}
  if(generic&&(!dc||!cc)){
   const status=step?String(r[step]||''):'';let k=/discharge|dchg|放电|放電/i.test(status)?'discharge':/charge|chg|充电|充電/i.test(status)?'charge':null;
   if(!k&&current){const i=number(r[current]);if(i!==null&&i!==0)k=i<0?'discharge':'charge';}
   if(k&&!(k==='charge'?cc:dc)){const v=val(r,generic);if(v!==null)g[k]=g[k]===null?v:Math.max(g[k],v);}
  }
 }
 const cycles=[...groups.values()].sort((a,z)=>a.cycle-z.cycle);
 const dis=cycles.filter(c=>c.discharge>0), paired=cycles.filter(c=>c.discharge>0&&c.charge>0);
 for(const c of cycles)c.ce=c.discharge>0&&c.charge>0?c.discharge/c.charge*100:null;
 row['Last recorded cycle']=cycles.length?cycles[cycles.length-1].cycle:'';
 if(dis.length){const first=dis[0],last=dis[dis.length-1];row['Reference cycle']=first.cycle;row['Last discharge cycle']=last.cycle;row['Retention (%)']=last.discharge/first.discharge*100;
 if(outUnit==='mAh/g')row['1st S. Dis. Cap. (mAh/g)']=first.discharge;
 else notes.push('Specific capacity unavailable: supply active material mass');
 row['ICE (%)']=first.ce===null?'':first.ce;
 }
 if(paired.length)row['Avg. Eff. CE (%)']=paired.reduce((a,c)=>a+c.ce,0)/paired.length;
 if(!dis.length)notes.push('Discharge capacity could not be identified');
 if(!dc&&generic)notes.push('Generic capacity split using step status, then current sign (+ charge / - discharge); verify polarity');
 notes.push('Capacity = maximum within each recorded cycle/direction; last cycle may be incomplete. Retention uses first positive discharge; mean CE uses paired positive cycles. Missing process fields require confirmation. CE@C/3 requires confirmed rate protocol.');
 row['Review notes']=notes.join('; ');
 return {row,cycles:cycles.map(c=>({'Cell number':b.name,'Source file':row['Source file'],'Cycle':c.cycle,'Charge capacity':c.charge,'Discharge capacity':c.discharge,'Capacity unit':outUnit,'CE (%)':c.ce}))};
}
window.BatteryRegister={fields,analyze};
const button=document.createElement('button');button.type='button';button.className='btn';button.id='battery-register-open';button.textContent='Battery summary / Excel';
document.getElementById('mcQuickSetup').prepend(button);
const dialog=document.createElement('dialog');dialog.id='battery-register';dialog.style.cssText='width:min(1100px,94vw);max-height:85vh;border:1px solid #ccc;border-radius:12px;padding:20px;';
dialog.innerHTML=`<h2>Battery summary</h2><p>One row per imported experimental file in Multi-Cell Overlay, including failed imports. Demo batteries are excluded. To use Data Library: select files → Compare selected → wait for import → open this summary. Plot and cycle filters do not limit this report.</p><p>Fill in process details below. Blank fields mean unknown. Filename pressure is an unconfirmed hint. Review calculation notes before use.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="register-export">Export Excel</button><button class="btn" id="register-close">Close</button><span id="register-status" role="status"></span></div><div id="register-table" style="overflow:auto;max-height:55vh;margin-top:12px"></div>`;
document.body.append(dialog);
let report=[];
const computed=new Set(['1st S. Dis. Cap. (mAh/g)','ICE (%)','Last recorded cycle','Retention (%)','Avg. Eff. CE (%)','Status','Filename pressure (MPa)','Source file','Analysis sheet','Reference cycle','Last discharge cycle','Discharge capacity unit','Review notes']);
const drafts=new WeakMap();
button.onclick=()=>{
 const batteries=App.mc.batteries.filter(b=>!['demo','empty'].includes(b.status));
 const status=dialog.querySelector('#register-status'),container=dialog.querySelector('#register-table');container.replaceChildren();
 if(batteries.some(b=>b.status==='loading')){status.textContent='Wait for all files to finish importing.';report=[];}
 else {report=batteries.map(b=>{const result=analyze(b);Object.assign(result.row,drafts.get(b)||{});return {...result,b};});status.textContent=report.length?`${report.length} files. Blank = unknown; metadata edits are retained for this session.`:'Import experimental files into Multi-Cell Overlay first.';}
 dialog.querySelector('#register-export').disabled=!report.length;
 const table=document.createElement('table'),head=document.createElement('tr');for(const f of fields){const th=document.createElement('th');th.textContent=f;th.style.minWidth='140px';head.append(th);}table.append(head);
 for(const item of report){const tr=document.createElement('tr');for(const f of fields){const td=document.createElement('td');if(computed.has(f)){td.textContent=String(item.row[f]??'');}else{const input=document.createElement('input');input.value=item.row[f];input.setAttribute('aria-label',`${item.b.name}: ${f}`);input.style.width='140px';input.oninput=()=>{item.row[f]=input.value;const draft=drafts.get(item.b)||{};draft[f]=input.value;drafts.set(item.b,draft);};td.append(input);}tr.append(td);}table.append(tr);}container.append(table);
 dialog.showModal();
};
dialog.querySelector('#register-close').onclick=()=>dialog.close();
dialog.querySelector('#register-export').onclick=()=>{
 try{const wb=XLSX.utils.book_new();
 const clean=v=>typeof v==='string'&&/^[=+\-@]/.test(v)?"'"+v:v; // Explicit text, never a spreadsheet formula.
 const add=(name,rows)=>{if(rows.length>1048576)throw Error('Excel row limit exceeded for '+name);const ws=XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(clean)));ws['!cols']=rows[0].map(h=>({wch:Math.min(60,Math.max(18,String(h).length+2))}));if(rows.length>1)ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,name);};
 add('Battery Summary',[fields,...report.map(x=>fields.map(f=>x.row[f]))]);
 const cycleFields=['Cell number','Source file','Cycle','Charge capacity','Discharge capacity','Capacity unit','CE (%)'];
 const rows=[cycleFields];for(const r of report)for(const c of r.cycles)rows.push(cycleFields.map(f=>c[f]));add('Cycle Metrics',rows);
 add('Read Me',[['Echem Plot Studio',APP_VERSION],['Scope','One row per imported file; repeated files are not merged. Failed files retained.'],['Unknown values','Blank = unknown; fill process metadata in preview. Filename pressure is not assigned to a process stage.'],['Calculations','Cycle maxima of cumulative charge/discharge capacity; requires explicit units. No raw integration. First positive discharge is retention reference; ICE requires charge in that same cycle. Average CE uses paired positive cycles.'],['Caution','Last cycle can be incomplete. Verify current polarity, mass, capacity units and cycle identifiers. CE@C/3 and R_bulk not inferred.'],['Privacy','Processed locally; no research data uploaded. Metadata edits last for the current session.']]);
 XLSX.writeFile(wb,`Battery-Summary-v${APP_VERSION}.xlsx`);
 }catch(e){dialog.querySelector('#register-status').textContent='Export failed: '+e.message;}
};
})();
