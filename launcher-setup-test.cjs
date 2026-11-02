// Exercise a fresh-download dependency failure in actual Windows PowerShell.
// Synthetic reader/pip fixtures avoid downloading packages or changing Python.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'echem setup '));
try {
 fs.copyFileSync(path.join(__dirname,'start_source_package.ps1'),path.join(root,'start_source_package.ps1'));
 fs.writeFileSync(path.join(root,'requirements_ndax.txt'),'# synthetic test only\n');
 fs.writeFileSync(path.join(root,'ndax_reader.py'),`import pathlib,sys
if not pathlib.Path(__file__).with_name('ready').exists():
    sys.stderr.write("ModuleNotFoundError: No module named 'NewareNDA'\\n")
    sys.exit(1)
print('synthetic reader ready')
`);
 fs.writeFileSync(path.join(root,'pip.py'),`import pathlib,sys
base=pathlib.Path(__file__).parent
sys.stderr.write('synthetic pip progress on stderr\\n')
if (base/'fail-install').exists():
    sys.exit(2)
(base/'ready').touch()
with (base/'installs').open('a') as f: f.write('installed\\n')
`);
 const launch=()=>spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'start_source_package.ps1'),'-CheckOnly'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});
 let result=launch();assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/Installing local NDAX dependencies/);
 assert.match(result.stdout,/Python NDAX reader is ready/);
 assert.equal(fs.readFileSync(path.join(root,'installs'),'utf8').replace(/\r/g,''),'installed\n');
 result=launch();assert.equal(result.status,0,result.stdout+result.stderr);
 assert.doesNotMatch(result.stdout,/Installing local NDAX dependencies/);
 assert.equal(fs.readFileSync(path.join(root,'installs'),'utf8').replace(/\r/g,''),'installed\n');
 fs.unlinkSync(path.join(root,'ready'));fs.writeFileSync(path.join(root,'fail-install'),'');
 result=launch();assert.notEqual(result.status,0);
 assert.match(result.stdout+result.stderr,/NDAX dependency installation failed/);
 assert.doesNotMatch(result.stdout,/Python NDAX reader is ready/);
 console.log('PASS: fresh setup survives missing-module stderr; installs once; reuses; reports installation failure.');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
