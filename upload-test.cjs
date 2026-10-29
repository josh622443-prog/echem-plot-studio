const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+path.resolve('Echem_Plot_Studio_v'+require('./package.json').version+'.html').replace(/\\/g,'/'));
await page.locator('#tabMenuTrigger').click();await page.locator('.tabbtn[data-tab="multicell"]').click();await page.locator('[data-mcmode="custom"]').click();
await page.locator('#controls-multicell [data-role="x-metric"]').selectOption('time');
await page.locator('#controls-multicell [data-role="x-unit"]').selectOption('h');
await page.locator('#controls-multicell [data-role="y1-metric"]').selectOption('voltage');
await page.locator('#controls-multicell [data-role="plot-style"]').selectOption('scatter');
await page.locator('#mcFileInput').setInputFiles(path.resolve('custom_axes_duration.csv'));
await page.waitForFunction(()=>App.mc.batteries.length===1 && App.mc.batteries[0].status==='loaded');
const result=await page.evaluate(()=>({status:App.mc.batteries[0].status,mapping:App.mc.batteries[0].mapping,values:mcGetAxisValues(App.mc.batteries[0],'x').values,diagnostics:document.getElementById('mcCustomDiagnostics').textContent,markers:document.querySelectorAll('#chart-multicell circle').length}));
if(result.markers<3 || JSON.stringify(result.values)!=='[0,0.5,1]'||errors.length)throw Error(JSON.stringify({result,errors}));
await page.locator('#chart-multicell').screenshot({path:'Custom_Axes_verified.png'});
fs.writeFileSync('upload-test-results.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

