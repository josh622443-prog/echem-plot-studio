const http=require('node:http');
const {spawn,spawnSync}=require('node:child_process');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=__dirname;
function start(port){return spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'start_source_package.ps1'),'-NoBrowser','-Port',String(port)],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});}
const fake=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,service:'ndax-api',reader:'old-reader',version:'1.24.15',root:'old-package'}));});
(async()=>{
 await new Promise(r=>fake.listen(0,'127.0.0.1',r));const occupied=fake.address().port;
 const first=start(occupied);let output='';first.stdout.on('data',d=>{output+=d;process.stdout.write(d);});first.stderr.on('data',d=>process.stderr.write(d));
 try{
  let url;
  for(let i=0;i<120;i++){
   const match=output.match(/Running at (http:\/\/127\.0\.0\.1:\d+\/)/);if(match){url=match[1];break;}
   if(first.exitCode!==null)throw Error('Launcher failed: '+output);
   await new Promise(r=>setTimeout(r,500));
  }
  assert.ok(url,'Launcher must report its actual URL');assert.notEqual(new URL(url).port,String(occupied));
  const status=await(await fetch(url+'health')).json();assert.equal(path.resolve(status.root),root);assert.equal(status.version,'1.26.0');
  const second=start(occupied);let reused='';second.stdout.on('data',d=>reused+=d);second.stderr.on('data',d=>reused+=d);
  const exit=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{spawnSync('taskkill',['/PID',String(second.pid),'/T','/F'],{windowsHide:true});reject(Error('Reuse did not finish'));},60000);second.once('exit',c=>{clearTimeout(timer);resolve(c);});});
  assert.equal(exit,0,reused);assert.ok(reused.includes('already running at '+url),reused);
  assert.equal((await(await fetch(`http://127.0.0.1:${occupied}/health`)).json()).reader,'old-reader');
  const html=await(await fetch(url)).text();assert.ok(html.includes('const APP_VERSION = "1.26.0"'));
  console.log('PASS: occupied port skipped; correct v1.26.0 served; matching instance reused; old service preserved.');
 }finally{if(first.exitCode===null)spawnSync('taskkill',['/PID',String(first.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});await new Promise(r=>fake.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
