const { spawn } = require('child_process');
const electronPath = require('electron');
const path = require('path');

const scriptPath = path.join(__dirname, 'render_pdf_electron.js');
const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [scriptPath], {
  env,
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`Render PDF finished with code ${code}`);
  process.exit(code || 0);
});

