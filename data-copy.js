/* Embedded in the release HTML; keep this source and the embedded script identical. */
(function(){
  const words={
    en:{copy:'Copy data',busy:'Preparing data…',done:'Copied {n} rows. Paste into Excel or Origin.',empty:'No data to copy. Load data or run this analysis first.',manual:'Clipboard unavailable. Press Ctrl+C to copy the selected data.',close:'Close',title:'Copy data',fail:'Could not prepare data: '},
    'zh-TW':{copy:'拷貝數據',busy:'正在整理數據…',done:'已拷貝 {n} 筆數據，可貼到 Excel 或 Origin。',empty:'目前沒有數據，請先匯入檔案或執行此頁分析。',manual:'剪貼簿無法自動寫入，請按 Ctrl+C 拷貝已選取的數據。',close:'關閉',title:'拷貝數據',fail:'無法整理數據：'},
    'zh-CN':{copy:'拷贝数据',busy:'正在整理数据…',done:'已拷贝 {n} 条数据，可粘贴到 Excel 或 Origin。',empty:'当前没有数据，请先导入文件或运行此页分析。',manual:'剪贴板无法自动写入，请按 Ctrl+C 拷贝已选中的数据。',close:'关闭',title:'拷贝数据',fail:'无法整理数据：'}
  };
  const text=key=>(words[App.lang]||words.en)[key];
  const blank=()=>({headers:[],rows:[]});
  const number=value=>value===null||value===undefined||String(value).trim()===''?NaN:Number(value);
  const field=(tab,key)=>ctrlVal(tab,key)||'';
  function collect(page){
    let data;
    if(page==='gcd'){
      data=collectGcdData();data.headers[3]=field(page,'col-capacity')||'Capacity';data.headers[4]=field(page,'col-voltage')||'Voltage';return data;
    }
    if(page==='dqdv'){
      data=collectDqdvData();data.headers[2]=field(page,'col-voltage')||'Voltage';data.headers[3]=`dQ/dV [${field(page,'col-capacity')} / ${field(page,'col-voltage')}]`;return data;
    }
    if(page==='cyclelife'){
      const c=field(page,'col-cycle'),q=field(page,'col-capacity'),ce=field(page,'col-ce');
      return {headers:[c,q,ce||'CE (%)'],rows:getRows(page).map(r=>[number(r[c]),number(r[q]),number(r[ce])]).filter(r=>Number.isFinite(r[0])&&(Number.isFinite(r[1])||Number.isFinite(r[2])))};
    }
    if(page==='retention'||page==='cbc')return App.computedData[page]||blank();
    if(page==='rate'){
      const c=field(page,'col-cycle'),q=field(page,'col-capacity'),rows=[];
      (App.tabState.rate.segments||[]).forEach(segment=>{
        const start=number(segment.start),end=number(segment.end);if(!Number.isFinite(start)||!Number.isFinite(end))return;
        const values=getRows(page).filter(r=>number(r[c])>=start&&number(r[c])<=end).map(r=>number(r[q])).filter(Number.isFinite);
        if(values.length)rows.push([segment.label||`${start}-${end}`,start,end,values.length,values.reduce((a,b)=>a+b,0)/values.length]);
      });
      return {headers:['Rate label','Start cycle','End cycle','N cycles averaged',q||'Average discharge capacity'],rows};
    }
    if(page==='batch'){
      const metric=field('batch','metric')||'retention',rows=[];
      App.batchFiles.filter(f=>f.enabled).forEach(f=>{const series=getBatchMetricSeries(f,metric);if(series)series.x.forEach((x,i)=>rows.push([f.name,x,series.y[i]]));});
      return {headers:['File','Cycle',metric],rows};
    }
    if(page==='nyquist'){
      const c=field(page,'col-cycle'),re=field(page,'col-zre'),im=field(page,'col-zim'),f=field(page,'col-freq'),v=field(page,'col-voltage'),rows=getRows(page),out=[];
      if(c===NYQUIST_AUTO_GROUP_KEY)injectEisBlockGroups(rows,re,im);
      Object.keys(App.tabState.nyquist.selectedCycles||{}).forEach(cycle=>{
        let sub=rows.filter(r=>number(r[c])===Number(cycle)&&isValidImpedanceRow(r,re,im));
        if(f)sub=sub.slice().sort((a,b)=>number(b[f])-number(a[f]));
        sub.forEach((r,i)=>out.push([Number(cycle),i+1,number(r[f]),number(r[re]),number(r[im]),ctrlVal(page,'invert-zim')?-number(r[im]):number(r[im]),number(r[v])]));
      });
      return {headers:['Measurement_or_Cycle','Point',f||'Frequency (Hz)',re,im,'Zim plotted (ohm)',v||'Voltage (V)'],rows:out};
    }
    if(page==='nyquist-vt'){
      const t=field('nyquist','col-time'),v=field('nyquist','col-voltage');if(!t||!v)return blank();
      return {headers:[t,v],rows:getRows('nyquist').map(r=>[number(r[t]),number(r[v])]).filter(r=>r.every(Number.isFinite)).sort((a,b)=>a[0]-b[0])};
    }
    if(page==='overpotential')return collectOverpotentialData();
    if(page==='overpotential-overview')return {headers:['Time (h)','Ewe (V)'],rows:(App.opTimeHoursFull||[]).map((t,i)=>[t,App.opEweFull[i]])};
    if(page==='overpotential-dvdt'){
      const rows=[];(App.opResults||[]).forEach(r=>r.tRelative.forEach((t,i)=>rows.push([r.stepId,t,r.dVdtSmoothed[i],Math.max(r.dVdtSmoothed[i],1e-3)])));
      return {headers:['Step','Time since step start (h)','Abs dV/dt (mV/h)','Plotted abs dV/dt (mV/h)'],rows};
    }
    if(page==='overpotential-sensitivity'){
      const selected=parseInt(document.querySelector('#panel-overpotential [data-role="sensitivity-step"]').value,10);
      const r=(App.opResults||[]).find(r=>r.stepId===selected)||App.opResults[0];if(!r||!App.opTimeHoursFull)return blank();
      const start=App.opTimeHoursFull.findIndex(t=>Math.abs(t-r.stepStartH)<1e-9);if(start<0)return blank();
      const thresholds=Array.from({length:28},(_,i)=>Number((.3+i*.1).toFixed(2)));
      const results=opThresholdSensitivity(r.tRelative,App.opEweFull.slice(start,start+r.tRelative.length),r.params,thresholds);
      return {headers:['Step','Slope threshold (mV/h)','Longest flat run (h)'],rows:results.map(s=>[r.stepId,s.threshold,s.longestRunH])};
    }
    if(page==='multicell'){
      const rows=[],headers=['Battery','Cycle / axis','X','Y','X field / unit','Y field / unit'];
      App.mc.batteries.forEach((battery,bi)=>{
        if(!battery.enabled||!mcIsReady(battery))return;
        if(App.mc.mode==='custom'){
          if(!battery.mapping.x||!battery.mapping.y1)return;
          const xr=mcGetAxisValues(battery,'x'),xLabel=mcAxisLabel(App.mc.customAxes.x.metric,xr.effectiveUnit);
          ['y1','y2'].forEach(axis=>{
            if(!App.mc.customAxes[axis].metric||!battery.mapping[axis])return;
            const yr=mcGetAxisValues(battery,axis),clean=pairwiseClean(xr.values,yr.values),yLabel=mcAxisLabel(App.mc.customAxes[axis].metric,yr.effectiveUnit);
            clean[0].forEach((x,i)=>rows.push([battery.name,axis.toUpperCase(),x,clean[1][i],xLabel,yLabel]));
          });return;
        }
        if(!mcRequiredFieldsOk(battery))return;
        const sheet=mcActiveSheetObj(battery),selected=mcEnsureSelectedCycles(battery,bi*4);
        Object.keys(selected).forEach(cycle=>{
          const sub=sheet.rows.filter(r=>Number(r[battery.mapping.cycle])===mcUnrebase(battery,Number(cycle)));
          const [q,v]=pairwiseClean(numCol(sub,battery.mapping.capacity),numCol(sub,battery.mapping.voltage));
          if(App.mc.mode==='gcd')q.forEach((x,i)=>rows.push([battery.name,'Cyc '+cycle,x,v[i],battery.mapping.capacity,battery.mapping.voltage]));
          else{const d=computeDqDv(q,v,250,7);d.v.forEach((x,i)=>rows.push([battery.name,'Cyc '+cycle,x,d.dqdv[i],battery.mapping.voltage,`dQ/dV [${battery.mapping.capacity} / ${battery.mapping.voltage}]`]));}
        });
      });return {headers,rows};
    }
    if(page==='drt')return document.getElementById('drtIntegratedFrame').contentWindow.getEchemDrtCopyData?.()||blank();
    if(page==='battery-info')return collectBatteryInfoData();
    if(page==='instructions')return collectInstructionsData();
    if(page==='changelog')return collectChangelogData();
    return blank();
  }
  function serialize(data){
    const cell=value=>{
      if(value===null||value===undefined||(typeof value==='number'&&!Number.isFinite(value)))return '';
      const valueText=String(value);return /[\t\r\n"]/.test(valueText)?'"'+valueText.replace(/"/g,'""')+'"':valueText;
    };
    return [data.headers,...data.rows].map(row=>row.map(cell).join('\t')).join('\r\n');
  }
  function manualCopy(content,status){
    let dialog=document.getElementById('dataCopyDialog');if(dialog)dialog.remove();
    dialog=document.createElement('dialog');dialog.id='dataCopyDialog';dialog.style.cssText='width:min(800px,90vw);border:1px solid #aaa;border-radius:10px;padding:18px';
    const title=document.createElement('p');title.textContent=text('manual');
    const area=document.createElement('textarea');area.readOnly=true;area.value=content;area.setAttribute('aria-label',text('title'));area.style.cssText='width:100%;height:45vh;font:12px monospace;white-space:pre';
    const close=document.createElement('button');close.className='btn';close.textContent=text('close');close.onclick=()=>dialog.close();
    dialog.append(title,area,close);document.body.appendChild(dialog);dialog.showModal();area.focus();area.select();status.textContent=text('manual');
  }
  async function copyTable(data,status){
    if(!data.rows?.length){status.textContent=text('empty');return 'empty';}
    const content=serialize(data);
    try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(content);}
    catch(error){
      const focus=document.activeElement,area=document.createElement('textarea');area.value=content;area.style.cssText='position:fixed;left:-10000px;top:0';document.body.appendChild(area);area.focus();area.select();
      let copied=false;try{copied=document.execCommand('copy');}catch(ignored){}area.remove();focus?.focus();
      if(!copied){manualCopy(content,status);return 'manual';}
    }
    status.textContent=text('done').replace('{n}',data.rows.length);return 'copied';
  }
  function addButton(container,page,prepend=false){
    const bar=document.createElement('div');bar.className='page-data-copy';bar.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px';
    const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.copyData=page;button.textContent=text('copy');
    const status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='font-size:12px;color:var(--muted)';
    button.onclick=async()=>{
      if(button.disabled)return;button.disabled=true;status.textContent=text('busy');
      try{await new Promise(resolve=>requestAnimationFrame(resolve));await copyTable(collect(page),status);}
      catch(error){status.textContent=text('fail')+error.message;}
      finally{button.disabled=false;}
    };
    bar.append(button,status);if(prepend)container.prepend(bar);else container.appendChild(bar);
  }
  document.querySelectorAll('.tabpanel[id^="panel-"]').forEach(panel=>addButton(panel,panel.id.slice(6),true));
  ['nyquist-vt','overpotential-overview','overpotential-dvdt','overpotential-sensitivity'].forEach(page=>{
    const chart=document.getElementById('chart-'+page);if(chart)addButton(chart.parentElement,page);
  });
  document.getElementById('langSwitch').addEventListener('click',()=>{
    document.querySelectorAll('[data-copy-data]').forEach(button=>button.textContent=text('copy'));
  });
  window.EchemDataCopy={collect,serialize,copyTable};
})();
