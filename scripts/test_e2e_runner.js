const { spawn } = require('child_process');
const electronPath = require('electron');
const path = require('path');

const scriptPath = path.join(__dirname, 'run_e2e_diagnostics.js');

const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [scriptPath], {
  env,
  stdio: ['inherit', 'pipe', 'pipe']
});

child.stdout.on('data', (d) => {
  process.stdout.write(d.toString());
});

child.stderr.on('data', (d) => {
  process.stderr.write(d.toString());
});

child.on('close', (code) => {
  console.log(`\nProcesso E2E finalizado com código ${code}.`);
  process.exit(code || 0);
});
