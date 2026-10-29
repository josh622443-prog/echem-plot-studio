const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const version=require('./package.json').version;
  await page.goto('file:///'+path.resolve(`Echem_Plot_Studio_v${version}.html`).replace(/\\/g,'/'));
  await page.waitForFunction(()=>typeof App!=='undefined'&&document.querySelector('#controls-gcd .sci-color-trigger'));
  await page.locator('#tabMenuTrigger').click();await page.locator('.tabbtn[data-tab="gcd"]').click();
  await page.evaluate(()=>{
   const state=App.tabState.gcd,sheet=App.sheets[state.sheet],column=ctrlVal('gcd','col-cycle');
   const first=Number(sheet.rows[0][column]),seed=sheet.rows.filter(row=>Number(row[column])===first);
   sheet.rows=Array.from({length:20},(_,index)=>seed.map(row=>({...row,[column]:index+1}))).flat();
   state.selectedCycles={1:'#112233',2:'#223344',10:'#334455',20:'#445566'};
   buildCycleList('gcd',state.sheet);renderGCD();
  });
  await page.waitForFunction(()=>document.querySelectorAll('#controls-gcd input[data-cyc-color] + .sci-color-trigger').length===20);
  const before=await page.evaluate(()=>{
   window.palettePaints=0;window.paletteOriginalGCD=renderGCD;
   renderGCD=function(){window.palettePaints++;if(!window.paletteProbeOnly)return window.paletteOriginalGCD();};
   window.paletteProbeOnly=!!location.search.includes('probe');
   return Object.keys(App.tabState.gcd.selectedCycles);
  });
  // Probe mode prevents the buggy version from performing hundreds of heavy paints.
  if(process.env.PALETTE_PROBE_ONLY)await page.evaluate(()=>window.paletteProbeOnly=true);
  const key=before[0];
  await page.locator(`#controls-gcd input[data-cyc-color="${key}"] + .sci-color-trigger`).evaluate(button=>button.click());
  await page.locator('#sciPalettePopover .sci-palette-actions button').nth(1).evaluate(button=>button.click());
  const after=await page.evaluate(()=>({selected:Object.keys(App.tabState.gcd.selectedCycles),paints:window.palettePaints,
    colors:Object.values(App.tabState.gcd.selectedCycles).map(c=>c.toLowerCase()),closed:!document.querySelector('#sciPalettePopover').classList.contains('open')}));
  console.log(JSON.stringify({before:before.length,after:after.selected.length,paints:after.paints}));
  assert.deepEqual(after.selected,before,'Palette must not select unchecked cycles');
  assert.equal(after.paints,1,'Palette must paint the chart once');assert.equal(after.closed,true);
  assert.deepEqual(after.colors.slice(0,4),['#e64b35','#4dbbd5','#00a087','#3c5488'].slice(0,before.length));
  if(!process.env.PALETTE_PROBE_ONLY){
   await page.locator(`#controls-gcd input[data-cyc-color="${key}"] + .sci-color-trigger`).evaluate(button=>button.click());
   await page.locator('#sciPalettePopover .sci-swatch').nth(4).evaluate(button=>button.click());
   const single=await page.evaluate(key=>({color:App.tabState.gcd.selectedCycles[key],selected:Object.keys(App.tabState.gcd.selectedCycles),paints:window.palettePaints}),key);
   assert.equal(single.color.toLowerCase(),'#f39b7f');assert.deepEqual(single.selected,before);assert.equal(single.paints,2);
   assert.equal(await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve(true),0))),true);
  }
  assert.deepEqual(errors,[]);console.log('Palette selection, bounded rendering, individual colors, and browser responsiveness passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
