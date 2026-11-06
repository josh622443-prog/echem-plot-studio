const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///'+path.resolve('Echem_Plot_Studio_v'+require('./package.json').version+'.html').replace(/\\/g,'/'));
await page.locator('.tabbtn[data-tab="multicell"]').click();await page.locator('[data-mcmode="custom"]').click();
await page.locator('#controls-multicell [data-role="x-metric"]').selectOption('time');
await page.locator('#controls-multicell [data-role="x-unit"]').selectOption('h');
await page.locator('#controls-multicell [data-role="y1-metric"]').selectOption('voltage');
await page.locator('#controls-multicell [data-role="plot-style"]').selectOption('scatter');
await page.locator('#mcFileInput').setInputFiles(path.resolve('custom_axes_duration.csv'));
await page.waitForFunction(()=>App.mc.batteries.length===1 && App.mc.batteries[0].status==='loaded');
const result=await page.evaluate(()=>({status:App.mc.batteries[0].status,mapping:App.mc.batteries[0].mapping,values:mcGetAxisValues(App.mc.batteries[0],'x').values,diagnostics:document.getElementById('mcCustomDiagnostics').textContent,markers:document.querySelectorAll('#chart-multicell circle').length}));
if(result.markers<3 || JSON.stringify(result.values)!=='[0,0.5,1]'||errors.length)throw Error(JSON.stringify({result,errors}));
await page.locator('#chart-multicell').screenshot({path:'Custom_Axes_verified.png'});
const assert = require('node:assert/strict');
async function checkExcel(filename, recordName, expectedSheet, expectedVoltage) {
  const bytes = await page.evaluate(record => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ['Cycle Index', 'Average Voltage(V)', 'Capacity(mAh)'], [1, 3.6, 1],
    ]), 'cycle');
    if (record) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ['Cycle Index', 'Average Voltage(V)', 'Voltage(V)', 'Capacity(mAh)'],
      [1, 3.6, 3.2, 0.2], [1, 3.6, 3.8, 0.7],
    ]), record);
    return Array.from(new Uint8Array(XLSX.write(book, {type:'array', bookType:'xlsx'})));
  }, recordName);
  const index = await page.evaluate(() => App.mc.batteries.length);
  await page.locator('#mcFileInput').setInputFiles({
    name: filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(bytes),
  });
  await page.waitForFunction(i => App.mc.batteries[i]?.status === 'loaded', index);
  const {sheet, voltage} = await page.evaluate(i => {
    const battery = App.mc.batteries[i];
    return {sheet: battery.activeSheet, voltage: battery.mapping.voltage};
  }, index);
  assert.equal(sheet, expectedSheet);
  assert.equal(voltage, expectedVoltage);
}
await page.locator('[data-mcmode="gcd"]').click();
await checkExcel('record-worker.xlsx', 'record', 'record', 'Voltage(V)');
await checkExcel('cycle-only.xlsx', null, 'cycle', 'Average Voltage(V)');
await page.evaluate(() => { window.Worker = class { constructor() { throw new Error('Test: worker unavailable'); } }; });
await checkExcel('record-fallback.xlsx', 'Record', 'Record', 'Voltage(V)');
assert.deepEqual(errors, []);
fs.writeFileSync('upload-test-results.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

