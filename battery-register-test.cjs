const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/battery-register.js','utf8').split("const button=document.createElement")[0]+'})();';
const sandbox={window:{}};vm.runInNewContext(code,sandbox);const {analyze}=sandbox.window.BatteryRegister;
function battery(headers,rows){return {name:'198-C1-350MPa',status:'loaded',sheets:{record:{headers,rows}}};}
const h=['Cycle Index','Charge Specific Capacity (mAh/g)','Discharge Specific Capacity (mAh/g)'];
const b=battery(h,[{[h[0]]:1,[h[1]]:100,[h[2]]:90},{[h[0]]:2,[h[1]]:90,[h[2]]:72},{[h[0]]:3,[h[1]]:10}]);
let r=analyze(b);assert.equal(r.row['ICE (%)'],90);assert.equal(r.row['Retention (%)'],80);assert.equal(r.row['Avg. Eff. CE (%)'],85);assert.equal(r.row['Last recorded cycle'],3);assert.equal(r.row['Last discharge cycle'],2);assert.equal(r.row['Filename pressure (MPa)'],350);assert.equal(r.row['Final Densification Step 2 (Pressure)'],'');
b.sheets.record.rows[0][h[2]]=null;r=analyze(b);assert.equal(r.row['Reference cycle'],2);assert.equal(r.row['ICE (%)'],80);
const g=battery(['Cycle Index','Spec. Cap.(mAh/g)','Current(mA)'],[{'Cycle Index':1,'Spec. Cap.(mAh/g)':100,'Current(mA)':1},{'Cycle Index':1,'Spec. Cap.(mAh/g)':80,'Current(mA)':-1}]);assert.equal(analyze(g).row['ICE (%)'],80);
const raw=battery(['Cycle Index','Charge Capacity(Ah)','Discharge Capacity(Ah)'],[{'Cycle Index':1,'Charge Capacity(Ah)':.1,'Discharge Capacity(Ah)':.09}]);raw.sourceMassG=.5;r=analyze(raw);assert.equal(r.row['1st S. Dis. Cap. (mAh/g)'],180);raw.sourceMassG=null;assert.equal(analyze(raw).row['1st S. Dis. Cap. (mAh/g)'],'');
assert(analyze({name:'bad',status:'failed',error:'Cannot read'}).row['Review notes'].includes('Cannot read'));
assert.equal(analyze(battery(['Cycle Index','Capacity'],[{'Cycle Index':1,Capacity:1}])).cycles.length,0);
console.log('Battery register: metrics, partial cycles, missing units, current direction, mass conversion, filename hint and failures passed.');
