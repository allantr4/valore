const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../src/ui/index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Localiza o bloco do qrScannerContainer
const startTag = '<!-- Painel Leitor de Câmera de QR Code em Tela Cheia (Estilo App Bancário) -->';
const endTag = '<!-- Seletor de Direção / Modo de Sincronização -->';

// Extrai o bloco
const startIdx = html.indexOf(startTag);
if (startIdx === -1) {
  console.error('Start tag not found!');
  process.exit(1);
}

const containerStart = html.indexOf('<div id="qrScannerContainer"', startIdx);
const containerEnd = html.indexOf('</div>\r\n\r\n          <div style="display: grid; grid-template-columns: 1.4fr 1fr;', startIdx);

if (containerEnd === -1) {
  // Tenta LF
  const containerEndLF = html.indexOf('</div>\n\n          <div style="display: grid; grid-template-columns: 1.4fr 1fr;', startIdx);
  if (containerEndLF === -1) {
    console.error('Container end not found!');
    process.exit(1);
  }
}

// Em vez de index manual sensível, vamos usar regex precisa:
const regex = /<!-- Painel Leitor de Câmera de QR Code em Tela Cheia \(Estilo App Bancário\) -->[\s\S]*?<\/label>\s*<\/div>\s*<\/div>/;
const match = html.match(regex);
if (!match) {
  console.error('Regex match failed!');
  process.exit(1);
}

const qrBlock = match[0];
// Remove do interior do modal
html = html.replace(regex, '');

// Ajusta o estilo para garantir z-index supremo de 1000050 e posicionamento fixo verdadeiro na raiz
const updatedQrBlock = qrBlock.replace(
  'z-index: 99999;',
  'z-index: 1000050; position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh;'
);

// Insere logo após o fechamento do modal de backup (#backupModal)
const targetInsert = '</div>\r\n  </div>\r\n\r\n  <!-- Botão Flutuante da Calculadora';
const targetInsertLF = '</div>\n  </div>\n\n  <!-- Botão Flutuante da Calculadora';

if (html.includes(targetInsert)) {
  html = html.replace(targetInsert, `</div>\r\n  </div>\r\n\r\n  ${updatedQrBlock}\r\n\r\n  <!-- Botão Flutuante da Calculadora`);
} else if (html.includes(targetInsertLF)) {
  html = html.replace(targetInsertLF, `</div>\n  </div>\n\n  ${updatedQrBlock}\n\n  <!-- Botão Flutuante da Calculadora`);
} else {
  console.error('Target insert position not found!');
  process.exit(1);
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✅ qrScannerContainer movido com sucesso para a raiz do index.html!');

