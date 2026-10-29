const fs=require('fs'), path=require('path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results=[];
 for(const file of ['baseline_v1.24.14.html','Echem_Plot_Studio_v1.24.15.html']){
  const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+path.resolve(file).replace(/\\/g,'/')); await page.waitForTimeout(1500);
  const r=await page.evaluate(()=>{
   App.lang='en'; App.mc.batteries=[]; mcSetMode('custom');
   App.mc.customAxes={x:{metric:'time',unit:'h'},y1:{metric:'voltage',unit:'V'},y2:{metric:null,unit:null}};
   const b=mcCreateBattery('duration regression'); b.status='loaded'; b.activeSheet='record'; b.sheetNames=['record'];
   b.sheets={record:{headers:['Time','Voltage(V)'],rows:[{Time:'00:00:00','Voltage(V)':3},{Time:'00:30:00','Voltage(V)':3.5},{Time:'01:00:00','Voltage(V)':4}]}};
   App.mc.batteries=[b]; mcAutoMapBattery(b); mcRenderBatteryList();
   document.querySelector('#controls-multicell [data-role="plot-style"]').value='scatter'; mcRenderChart();
   return {values:mcGetAxisValues(b,'x').values, circles:document.querySelectorAll('#chart-multicell circle').length, svg:document.getElementById('chart-multicell').innerHTML,diagnostics:document.getElementById('mcCustomDiagnostics')?.textContent};
  });
  results.push({file,values:r.values,circles:r.circles,diagnostics:r.diagnostics,errors});
  if(file.includes('1.24.15')){
   if(JSON.stringify(r.values)!=='[0,0.5,1]'||r.circles<3)throw Error('Duration render failed');
   fs.writeFileSync('Custom_Axes_verified.svg',r.svg);
   const more=await page.evaluate(()=>{
    const b=App.mc.batteries[0]; const checks=[];
    function check(name,ok){if(!ok)throw Error(name); checks.push(name);}
    check('fractional, long and day durations',mcParseDurationSeconds('25:00:00.5')===90000.5 && mcParseDurationSeconds('2 d 01:00:00')===176400);
    check('reject malformed duration',Number.isNaN(mcParseDurationSeconds('00:60:00')) && Number.isNaN(mcParseDurationSeconds('2026-10-08 00:30:00')));
    b.sheets.record={headers:['Time(min)','Voltage(mV)','Current(mA)'],rows:[{'Time(min)':0,'Voltage(mV)':3000,'Current(mA)':1},{'Time(min)':30,'Voltage(mV)':3500,'Current(mA)':2},{'Time(min)':60,'Voltage(mV)':4000,'Current(mA)':3},{'Time(min)':' ','Voltage(mV)':4200,'Current(mA)':4}]};
    mcAutoMapBattery(b); check('numeric time header conversion',JSON.stringify(mcGetAxisValues(b,'x').values.slice(0,3))==='[0,0.5,1]');
    check('voltage conversion and missing row',mcGetAxisValues(b,'y1').values[1]===3.5 && Number.isNaN(mcGetAxisValues(b,'x').values[3]));
    for(const style of ['line','line-markers','scatter']){
     const sel=document.querySelector('#controls-multicell [data-role="plot-style"]');sel.value=style;sel.dispatchEvent(new Event('input'));
     check('style trigger '+style,document.getElementById('mcCustomDiagnostics').textContent.includes('3 / 4'));
    }
    const unit=document.querySelector('#controls-multicell [data-role="x-unit"]');unit.value='min';unit.dispatchEvent(new Event('change'));check('unit change trigger',mcGetAxisValues(b,'x').values[1]===30);
    App.mc.customAxes.y2={metric:'current',unit:'A'};mcAutoMapBattery(b);mcRenderChart();check('optional Y2 render',document.getElementById('chart-multicell').textContent.includes('Current (A)'));
    b.sheets.record.rows=[{'Time(min)':'invalid','Voltage(mV)':4000}];mcRenderChart();check('empty data diagnostic',document.getElementById('mcCustomDiagnostics').textContent.includes('0 / 1'));
    return checks;
   }); results.push({checks:more});
  }
  await page.close();
 }
 fs.writeFileSync('test-results.json',JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
