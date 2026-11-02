/**
 * Valore - Sincronizador Automático Desktop -> Mobile Android
 * Garante paridade total contínua entre Desktop e Mobile.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const MOBILE_DIR = path.resolve(__dirname, '../');
const WWW_DIR = path.join(MOBILE_DIR, 'www');

console.log('=== VALORE MOBILE: INICIANDO SINCRONIZAÇÃO COM O DESKTOP ===');
console.log(`Diretório Raiz (Desktop): ${ROOT_DIR}`);
console.log(`Diretório Destino (Mobile WWW): ${WWW_DIR}`);

// 1. Garante que a pasta www exista
if (!fs.existsSync(WWW_DIR)) {
  fs.mkdirSync(WWW_DIR, { recursive: true });
}

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  files.forEach(file => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

// 2. Copia UI completa (HTML, CSS, JS, Assets, bibliotecas)
const uiSource = path.join(ROOT_DIR, 'src', 'ui');
console.log('-> Copiando camada de Interface (UI)...');
copyFolderRecursiveSync(uiSource, WWW_DIR);

// 3. Copia Core de Regras de Negócio
const coreDest = path.join(WWW_DIR, 'core');
if (!fs.existsSync(coreDest)) {
  fs.mkdirSync(coreDest, { recursive: true });
}
console.log('-> Copiando Núcleo Financeiro (financeService.js e storage.js)...');
fs.copyFileSync(path.join(ROOT_DIR, 'src', 'core', 'financeService.js'), path.join(coreDest, 'financeService.js'));
fs.copyFileSync(path.join(ROOT_DIR, 'src', 'core', 'storage.js'), path.join(coreDest, 'storage.js'));

// 4. Ajusta caminhos em index.html no WWW caso necessário
let htmlContent = fs.readFileSync(path.join(WWW_DIR, 'index.html'), 'utf8');

// Garante que as tags de viewport e safe-area mobile estejam perfeitas
if (!htmlContent.includes('viewport-fit=cover')) {
  htmlContent = htmlContent.replace(
    '<meta name="viewport"',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"'
  );
}

// Se o HTML chamar ../core/financeService.js, ajusta para ./core/financeService.js
htmlContent = htmlContent.replace(/src="\.\.\/core\//g, 'src="core/');
fs.writeFileSync(path.join(WWW_DIR, 'index.html'), htmlContent, 'utf8');

// 5. Ajusta app.js no WWW caso tenha referências de caminho Desktop
let jsContent = fs.readFileSync(path.join(WWW_DIR, 'app.js'), 'utf8');
jsContent = jsContent.replace(/src="\.\.\/core\//g, 'src="core/');
fs.writeFileSync(path.join(WWW_DIR, 'app.js'), jsContent, 'utf8');

console.log('✔ Sincronização de paridade concluída com 100% de sucesso!');
