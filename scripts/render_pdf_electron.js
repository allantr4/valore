const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1200,
      height: 1600,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const htmlPath = path.join(__dirname, 'manual_sincronizacao.html');
    await win.loadFile(htmlPath);
    await new Promise(r => setTimeout(r, 1200));

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      preferCSSPageSize: true
    });

    const outputPath = path.join(__dirname, '../Manual_Sincronizacao_Valore.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    const stats = fs.statSync(outputPath);
    console.log(`🎉 PDF gerado com sucesso via Electron! Tamanho: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
  } finally {
    app.quit();
  }
});

