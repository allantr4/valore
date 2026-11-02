/**
 * Valore - Verificador Automatizado de Integridade Pré-Commit & Pré-Release
 * Executa checagem de sintaxe, integridade de inicialização e paridade de versões.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
let hasErrors = false;

function logPass(msg) {
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${msg}`);
  hasErrors = true;
}

console.log('\n======================================================');
console.log('   💎 Valore - Verificação Pré-Commit & Pré-Release   ');
console.log('======================================================\n');

// 1. Verificação de Sintaxe de Scripts
console.log('[1/3] Validando sintaxe e parsing JavaScript...');
const scriptsToValidate = [
  'src/ui/app.js',
  'src/core/financeService.js',
  'src/main/main.js',
  'Android/www/app.js',
  'Android/www/core/financeService.js',
  'IOs/www/app.js',
  'IOs/www/core/financeService.js'
];

for (const relPath of scriptsToValidate) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    logFail(`Arquivo não encontrado: ${relPath}`);
    continue;
  }

  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: relPath });
    logPass(`${relPath} (Sintaxe válida - ${code.split('\n').length} linhas)`);
  } catch (err) {
    logFail(`${relPath} com erro de sintaxe: ${err.message}`);
  }
}

// 2. Verificação de Integridade Estrutural do app.js
console.log('\n[2/3] Validando inicialização e pontos de entrada (app.js)...');
const appJsPath = path.join(rootDir, 'src/ui/app.js');
if (fs.existsSync(appJsPath)) {
  const appContent = fs.readFileSync(appJsPath, 'utf8');

  if (appContent.includes('document.addEventListener(\'DOMContentLoaded\'') || appContent.includes('document.addEventListener("DOMContentLoaded"')) {
    logPass('DOMContentLoaded registrado no app.js');
  } else {
    logFail('DOMContentLoaded NÃO foi encontrado no app.js! O app pode ficar travado na inicialização.');
  }

  if (appContent.includes('initApp()')) {
    logPass('Chamada initApp() presente');
  } else {
    logFail('Chamada initApp() ausente no app.js!');
  }

  if (appContent.includes('[truncated') || appContent.includes('... [truncated')) {
    logFail('Detectado texto de truncamento acidental no app.js!');
  } else {
    logPass('Ausência de artefatos de truncamento no app.js');
  }
} else {
  logFail('src/ui/app.js não existe!');
}

// 3. Verificação de Paridade de Versões
console.log('\n[3/3] Validando paridade de versões entre arquivos...');
let versionJsonVer = null;
try {
  const vJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'version.json'), 'utf8'));
  versionJsonVer = vJson.version;
  logPass(`version.json: v${versionJsonVer}`);
} catch (e) {
  logFail(`Erro ao ler version.json: ${e.message}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  if (pkg.version === versionJsonVer) {
    logPass(`package.json: v${pkg.version} (Alinhado)`);
  } else {
    logFail(`Divergência de versão no package.json: v${pkg.version} vs v${versionJsonVer} no version.json`);
  }
} catch (e) {
  logFail(`Erro ao ler package.json: ${e.message}`);
}

try {
  const financeCore = fs.readFileSync(path.join(rootDir, 'src/core/financeService.js'), 'utf8');
  const match = financeCore.match(/getAppVersion\(\)\s*\{\s*return\s*['"]([^'"]+)['"]/);
  if (match && match[1] === versionJsonVer) {
    logPass(`financeService.js getAppVersion(): v${match[1]} (Alinhado)`);
  } else {
    logFail(`Divergência de versão no financeService.js: ${match ? 'v' + match[1] : 'não encontrada'} vs v${versionJsonVer}`);
  }
} catch (e) {
  logFail(`Erro ao validar financeService.js: ${e.message}`);
}

console.log('\n======================================================');
if (hasErrors) {
  console.error('\x1b[31m⛔ TESTES FALHARAM! Corrija os erros antes de comitar ou publicar.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m🎉 TODOS OS TESTES PASSARAM! Sistema 100% pronto e íntegro.\x1b[0m');
  process.exit(0);
}

