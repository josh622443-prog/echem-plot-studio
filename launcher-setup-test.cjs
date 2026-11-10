// Verify recovery from a read-only, broken package directory using Windows PowerShell.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'echem setup '));
const locked = path.join(root, '.runtime', 'python', 'locked.txt');
try {
  for (const name of ['start_source_package.ps1', 'runtime_packages.py']) {
    fs.copyFileSync(path.join(__dirname, name), path.join(root, name));
  }
  fs.mkdirSync(path.dirname(locked), {recursive: true});
  fs.writeFileSync(locked, 'old package remains intact');
  fs.chmodSync(locked, 0o444);
  fs.writeFileSync(path.join(root, 'requirements_ndax.txt'), '# synthetic test only\n');
  fs.writeFileSync(path.join(root, 'ndax_reader.py'), [
    'from pathlib import Path',
    'from runtime_packages import activate_packages',
    'packages = activate_packages()',
    'if not (packages / "ready").exists():',
    '    raise ImportError("synthetic broken dependency")',
    'print("synthetic reader ready")',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'pip.py'), [
    'import os, pathlib, sys',
    'base = pathlib.Path(__file__).parent',
    'sys.stderr.write("synthetic pip progress on stderr\\n")',
    'if (base / "fail-install").exists(): sys.exit(2)',
    'target = pathlib.Path(sys.argv[sys.argv.index("--target") + 1])',
    'assert target != base / ".runtime" / "python"',
    'assert "--upgrade" not in sys.argv',
    '(target / "ready").touch()',
    'with (base / "installs").open("a") as output: output.write(str(target) + "\\n")',
  ].join('\n'));
  const launch = () => spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(root, 'start_source_package.ps1'), '-CheckOnly',
  ], {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000,
      env: {...process.env, ECHEM_RUNTIME_PACKAGES: ''}});
  let result = launch();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const marker = fs.readdirSync(path.join(root, '.runtime')).find(name => name.startsWith('active-'));
  assert.ok(marker);
  const pointer = path.join(root, '.runtime', marker);
  const active = fs.readFileSync(pointer, 'utf8');
  assert.ok(active.startsWith('packages-'));
  assert.equal(fs.readFileSync(locked, 'utf8'), 'old package remains intact');
  result = launch();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /Installing local NDAX dependencies/);
  assert.equal(fs.readFileSync(path.join(root, 'installs'), 'utf8').trim().split(/\r?\n/).length, 1);
  fs.unlinkSync(path.join(root, '.runtime', active, 'ready'));
  fs.writeFileSync(path.join(root, 'fail-install'), '');
  result = launch();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /NDAX dependency installation failed/);
  assert.equal(fs.readFileSync(pointer, 'utf8'), active);
  assert.equal(fs.readFileSync(locked, 'utf8'), 'old package remains intact');
  console.log('PASS: isolated recovery, read-only old packages preserved, verified packages reused, failed install leaves selection intact.');
} finally {
  if (fs.existsSync(locked)) fs.chmodSync(locked, 0o666);
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  fs.rmSync(root, {recursive: true, force: true});
}
