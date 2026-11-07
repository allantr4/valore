using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using System.Diagnostics;
using Microsoft.Win32;

[assembly: AssemblyTitle("Instalador Valore Financeiro")]
[assembly: AssemblyDescription("Instalador Oficial do Valore - Gestão Financeira Inteligente")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("Valore Finanças")]
[assembly: AssemblyProduct("Valore - Gestão Financeira Inteligente")]
[assembly: AssemblyCopyright("Copyright © 2026 Valore Finanças")]
[assembly: AssemblyTrademark("Valore")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace ValoreInstaller
{
    public class InstallerForm : Form
    {
        // P/Invoke para mover janela sem bordas
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        // Cores do Tema Escuro Valore
        private static readonly Color BgDark = Color.FromArgb(15, 23, 42);          // #0f172a
        private static readonly Color BgHeader = Color.FromArgb(11, 17, 32);        // #0b1120
        private static readonly Color BgCard = Color.FromArgb(30, 41, 59);          // #1e293b
        private static readonly Color BorderColor = Color.FromArgb(51, 65, 85);     // #334155
        private static readonly Color PrimaryColor = Color.FromArgb(99, 102, 241);   // #6366f1
        private static readonly Color PrimaryHover = Color.FromArgb(79, 70, 229);   // #4f46e5
        private static readonly Color SuccessColor = Color.FromArgb(16, 185, 129);  // #10b981
        private static readonly Color TextMain = Color.FromArgb(248, 250, 252);     // #f8fafc
        private static readonly Color TextMuted = Color.FromArgb(148, 163, 184);    // #94a3b8

        // Painéis das Etapas
        private Panel panelHeader;
        private Panel panelSetup;
        private Panel panelProgress;
        private Panel panelSuccess;

        // Controles Tela 1: Configuração
        private TextBox txtPath;
        private Button btnBrowse;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private CheckBox chkLaunchAfter;
        private Button btnInstall;
        private Button btnCancel;

        // Controles Tela 2: Progresso
        private Label lblProgressTitle;
        private Label lblProgressDetail;
        private ProgressBar progressBar;
        private Label lblProgressPercent;

        // Controles Tela 3: Sucesso
        private Label lblSuccessTitle;
        private Label lblSuccessDesc;
        private Button btnLaunchApp;
        private Button btnOpenFolder;
        private Button btnFinish;

        // Estado
        private string finalInstallPath = "";
        private Image appLogo = null;
        private bool isAutoUpdateMode = false;
        private string explicitDir = null;
        private const string AppVersion = "1.3.8";

        public InstallerForm(bool autoUpdate = false, string explicitInstallDir = null)
        {
            this.isAutoUpdateMode = autoUpdate;
            this.explicitDir = explicitInstallDir;
            this.Text = "Valore - Instalador Oficial";
            this.Size = new Size(720, 520);
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = BgDark;
            this.ForeColor = TextMain;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            // Carrega ícone e logotipo dos recursos embutidos
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream s = asm.GetManifestResourceStream("logo.png"))
                {
                    if (s != null) appLogo = Image.FromStream(s);
                }
            }
            catch {}

            BuildHeader();
            BuildSetupPanel();
            BuildProgressPanel();
            BuildSuccessPanel();

            if (!string.IsNullOrEmpty(explicitDir) && Directory.Exists(explicitDir))
            {
                txtPath.Text = explicitDir;
            }
            else if (isAutoUpdateMode)
            {
                try
                {
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Valore"))
                    {
                        if (key != null)
                        {
                            object loc = key.GetValue("InstallLocation");
                            if (loc != null && !string.IsNullOrEmpty(loc.ToString()))
                            {
                                txtPath.Text = loc.ToString();
                            }
                        }
                    }
                }
                catch {}
            }

            if (isAutoUpdateMode)
            {
                this.Shown += (s, e) =>
                {
                    KillRunningValoreProcesses();
                    WaitForFilesToBeUnlocked(txtPath.Text.Trim());
                    Thread.Sleep(400);
                    StartInstallation();
                };
            }

            ShowPanel(panelSetup);
        }

        // Desenha borda sutil ao redor da janela sem bordas
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (Pen p = new Pen(BorderColor, 1.5f))
            {
                e.Graphics.DrawRectangle(p, 0, 0, this.Width - 1, this.Height - 1);
            }
        }

        private void BuildHeader()
        {
            panelHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 68,
                BackColor = BgHeader
            };
            panelHeader.MouseDown += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    ReleaseCapture();
                    SendMessage(this.Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                }
            };

            // Logo
            PictureBox picLogo = new PictureBox
            {
                Size = new Size(44, 44),
                Location = new Point(20, 12),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            if (appLogo != null) picLogo.Image = appLogo;
            else picLogo.Image = SystemIcons.Application.ToBitmap();
            panelHeader.Controls.Add(picLogo);

            // Título
            Label lblTitle = new Label
            {
                Text = "Valore",
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(72, 11),
                AutoSize = true
            };
            panelHeader.Controls.Add(lblTitle);

            // Subtítulo
            Label lblSub = new Label
            {
                Text = "Gestão Financeira Inteligente • Versão 1.0.0 (64-bit)",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = TextMuted,
                Location = new Point(74, 38),
                AutoSize = true
            };
            panelHeader.Controls.Add(lblSub);

            // Botão Fechar
            Button btnClose = new Button
            {
                Text = "✕",
                Size = new Size(38, 32),
                Location = new Point(this.Width - 46, 14),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.Transparent,
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.MouseEnter += (s, e) => { btnClose.ForeColor = Color.FromArgb(239, 68, 68); btnClose.BackColor = Color.FromArgb(30, 41, 59); };
            btnClose.MouseLeave += (s, e) => { btnClose.ForeColor = TextMuted; btnClose.BackColor = Color.Transparent; };
            btnClose.Click += (s, e) => this.Close();
            panelHeader.Controls.Add(btnClose);

            // Botão Minimizar
            Button btnMin = new Button
            {
                Text = "—",
                Size = new Size(38, 32),
                Location = new Point(this.Width - 88, 14),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.Transparent,
                ForeColor = TextMuted,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnMin.FlatAppearance.BorderSize = 0;
            btnMin.MouseEnter += (s, e) => { btnMin.ForeColor = TextMain; btnMin.BackColor = Color.FromArgb(30, 41, 59); };
            btnMin.MouseLeave += (s, e) => { btnMin.ForeColor = TextMuted; btnMin.BackColor = Color.Transparent; };
            btnMin.Click += (s, e) => this.WindowState = FormWindowState.Minimized;
            panelHeader.Controls.Add(btnMin);

            this.Controls.Add(panelHeader);
        }

        private void BuildSetupPanel()
        {
            panelSetup = new Panel
            {
                Location = new Point(0, 68),
                Size = new Size(720, 452),
                BackColor = BgDark
            };

            // Banner Boas-vindas
            Panel cardWelcome = new Panel
            {
                Location = new Point(28, 20),
                Size = new Size(664, 85),
                BackColor = BgCard
            };
            cardWelcome.Paint += (s, e) => DrawRoundedCard(e.Graphics, cardWelcome, BorderColor);

            Label lblWTitle = new Label
            {
                Text = "Bem-vindo ao Instalador do Valore",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(18, 14),
                AutoSize = true
            };
            cardWelcome.Controls.Add(lblWTitle);

            Label lblWDesc = new Label
            {
                Text = "O instalador configurará o aplicativo de gestão financeira completa no seu computador com atalhos, banco de dados local seguro e atualizações automáticas.",
                Font = new Font("Segoe UI", 8.8f, FontStyle.Regular),
                ForeColor = TextMuted,
                Location = new Point(18, 42),
                Size = new Size(628, 34)
            };
            cardWelcome.Controls.Add(lblWDesc);
            panelSetup.Controls.Add(cardWelcome);

            // Card Local de Instalação
            Panel cardPath = new Panel
            {
                Location = new Point(28, 118),
                Size = new Size(664, 110),
                BackColor = BgCard
            };
            cardPath.Paint += (s, e) => DrawRoundedCard(e.Graphics, cardPath, BorderColor);

            Label lblPathTitle = new Label
            {
                Text = "📁 Pasta de Instalação:",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(18, 14),
                AutoSize = true
            };
            cardPath.Controls.Add(lblPathTitle);

            string defaultPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Valore");
            txtPath = new TextBox
            {
                Text = defaultPath,
                Location = new Point(20, 42),
                Size = new Size(510, 28),
                BackColor = Color.FromArgb(15, 23, 42),
                ForeColor = TextMain,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular)
            };
            cardPath.Controls.Add(txtPath);

            btnBrowse = CreateStyledButton("Procurar...", 110, 30, Color.FromArgb(51, 65, 85), Color.FromArgb(71, 85, 105), TextMain);
            btnBrowse.Location = new Point(536, 41);
            btnBrowse.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Selecione a pasta onde o Valore será instalado:";
                    fbd.SelectedPath = txtPath.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtPath.Text = Path.Combine(fbd.SelectedPath, "Valore");
                    }
                }
            };
            cardPath.Controls.Add(btnBrowse);

            Label lblPathHelp = new Label
            {
                Text = "💡 Recomendado: Instalação segura no perfil de usuário sem requerer permissões de Administrador.",
                Font = new Font("Segoe UI", 8.2f, FontStyle.Regular),
                ForeColor = Color.FromArgb(99, 102, 241),
                Location = new Point(18, 80),
                AutoSize = true
            };
            cardPath.Controls.Add(lblPathHelp);
            panelSetup.Controls.Add(cardPath);

            // Card Opções de Atalho
            Panel cardOptions = new Panel
            {
                Location = new Point(28, 240),
                Size = new Size(664, 115),
                BackColor = BgCard
            };
            cardOptions.Paint += (s, e) => DrawRoundedCard(e.Graphics, cardOptions, BorderColor);

            Label lblOptTitle = new Label
            {
                Text = "⚙️ Atalhos e Configurações Adicionais:",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(18, 12),
                AutoSize = true
            };
            cardOptions.Controls.Add(lblOptTitle);

            chkDesktopShortcut = new CheckBox
            {
                Text = "Criar atalho na Área de Trabalho (Desktop)",
                Checked = true,
                Location = new Point(22, 38),
                AutoSize = true,
                ForeColor = TextMain,
                Cursor = Cursors.Hand
            };
            cardOptions.Controls.Add(chkDesktopShortcut);

            chkStartMenuShortcut = new CheckBox
            {
                Text = "Criar atalho no Menu Iniciar do Windows",
                Checked = true,
                Location = new Point(22, 62),
                AutoSize = true,
                ForeColor = TextMain,
                Cursor = Cursors.Hand
            };
            cardOptions.Controls.Add(chkStartMenuShortcut);

            chkLaunchAfter = new CheckBox
            {
                Text = "Iniciar o Valore automaticamente após a instalação",
                Checked = true,
                Location = new Point(22, 86),
                AutoSize = true,
                ForeColor = TextMain,
                Cursor = Cursors.Hand
            };
            cardOptions.Controls.Add(chkLaunchAfter);

            panelSetup.Controls.Add(cardOptions);

            // Botões de Ação Inferiores
            btnCancel = CreateStyledButton("Cancelar", 115, 42, Color.FromArgb(30, 41, 59), Color.FromArgb(51, 65, 85), TextMuted);
            btnCancel.Location = new Point(410, 385);
            btnCancel.Click += (s, e) => this.Close();
            panelSetup.Controls.Add(btnCancel);

            btnInstall = CreateStyledButton("Instalar Valore", 160, 42, PrimaryColor, PrimaryHover, Color.White, true);
            btnInstall.Location = new Point(532, 385);
            btnInstall.Click += (s, e) => StartInstallation();
            panelSetup.Controls.Add(btnInstall);

            this.Controls.Add(panelSetup);
        }

        private void BuildProgressPanel()
        {
            panelProgress = new Panel
            {
                Location = new Point(0, 68),
                Size = new Size(720, 452),
                BackColor = BgDark,
                Visible = false
            };

            Panel cardProgress = new Panel
            {
                Location = new Point(40, 60),
                Size = new Size(640, 280),
                BackColor = BgCard
            };
            cardProgress.Paint += (s, e) => DrawRoundedCard(e.Graphics, cardProgress, BorderColor);

            lblProgressTitle = new Label
            {
                Text = "Instalando o Valore no seu Computador...",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(30, 35),
                AutoSize = true
            };
            cardProgress.Controls.Add(lblProgressTitle);

            lblProgressDetail = new Label
            {
                Text = "Preparando a extração dos arquivos...",
                Font = new Font("Segoe UI", 9.2f, FontStyle.Regular),
                ForeColor = TextMuted,
                Location = new Point(32, 75),
                Size = new Size(575, 30)
            };
            cardProgress.Controls.Add(lblProgressDetail);

            progressBar = new ProgressBar
            {
                Location = new Point(32, 120),
                Size = new Size(575, 26),
                Minimum = 0,
                Maximum = 100,
                Value = 0
            };
            cardProgress.Controls.Add(progressBar);

            lblProgressPercent = new Label
            {
                Text = "0%",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = PrimaryColor,
                Location = new Point(32, 160),
                AutoSize = true
            };
            cardProgress.Controls.Add(lblProgressPercent);

            Label lblProgressSub = new Label
            {
                Text = "Isso pode levar alguns segundos. Por favor, aguarde...",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = TextMuted,
                Location = new Point(32, 210),
                AutoSize = true
            };
            cardProgress.Controls.Add(lblProgressSub);

            panelProgress.Controls.Add(cardProgress);
            this.Controls.Add(panelProgress);
        }

        private void BuildSuccessPanel()
        {
            panelSuccess = new Panel
            {
                Location = new Point(0, 68),
                Size = new Size(720, 452),
                BackColor = BgDark,
                Visible = false
            };

            Panel cardSuccess = new Panel
            {
                Location = new Point(40, 30),
                Size = new Size(640, 320),
                BackColor = BgCard
            };
            cardSuccess.Paint += (s, e) => DrawRoundedCard(e.Graphics, cardSuccess, BorderColor);

            // Ícone Sucesso
            Label lblCheck = new Label
            {
                Text = "✓",
                Font = new Font("Segoe UI", 36f, FontStyle.Bold),
                ForeColor = SuccessColor,
                Location = new Point(32, 25),
                Size = new Size(60, 60),
                TextAlign = ContentAlignment.MiddleCenter
            };
            cardSuccess.Controls.Add(lblCheck);

            lblSuccessTitle = new Label
            {
                Text = "🎉 Instalação Concluída com Sucesso!",
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                ForeColor = TextMain,
                Location = new Point(102, 35),
                AutoSize = true
            };
            cardSuccess.Controls.Add(lblSuccessTitle);

            lblSuccessDesc = new Label
            {
                Text = "O Valore foi instalado com sucesso e está 100% pronto para uso no seu computador.\nVocê pode iniciá-lo imediatamente clicando no botão abaixo ou através dos atalhos criados.",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = TextMuted,
                Location = new Point(35, 105),
                Size = new Size(575, 45)
            };
            cardSuccess.Controls.Add(lblSuccessDesc);

            // Box de Informação
            Panel infoBox = new Panel
            {
                Location = new Point(35, 165),
                Size = new Size(570, 75),
                BackColor = Color.FromArgb(15, 23, 42)
            };
            infoBox.Paint += (s, e) => DrawRoundedCard(e.Graphics, infoBox, BorderColor);

            Label lblInfo1 = new Label
            {
                Text = "📍 Aplicativo instalado em:",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = TextMuted,
                Location = new Point(15, 12),
                AutoSize = true
            };
            infoBox.Controls.Add(lblInfo1);

            Label lblInfoPath = new Label
            {
                Text = "",
                Name = "lblInfoPath",
                Font = new Font("Segoe UI", 8.8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(99, 102, 241),
                Location = new Point(15, 34),
                Size = new Size(535, 30)
            };
            infoBox.Controls.Add(lblInfoPath);
            cardSuccess.Controls.Add(infoBox);

            panelSuccess.Controls.Add(cardSuccess);

            // Botões Finais
            btnOpenFolder = CreateStyledButton("Abrir Pasta", 125, 42, Color.FromArgb(30, 41, 59), Color.FromArgb(51, 65, 85), TextMain);
            btnOpenFolder.Location = new Point(230, 380);
            btnOpenFolder.Click += (s, e) =>
            {
                if (Directory.Exists(finalInstallPath)) Process.Start("explorer.exe", finalInstallPath);
            };
            panelSuccess.Controls.Add(btnOpenFolder);

            btnFinish = CreateStyledButton("Fechar", 100, 42, Color.FromArgb(30, 41, 59), Color.FromArgb(51, 65, 85), TextMuted);
            btnFinish.Location = new Point(365, 380);
            btnFinish.Click += (s, e) => this.Close();
            panelSuccess.Controls.Add(btnFinish);

            btnLaunchApp = CreateStyledButton("Iniciar Valore Agora", 190, 42, SuccessColor, Color.FromArgb(5, 150, 105), Color.White, true);
            btnLaunchApp.Location = new Point(475, 380);
            btnLaunchApp.Click += (s, e) =>
            {
                LaunchValoreExe();
                this.Close();
            };
            panelSuccess.Controls.Add(btnLaunchApp);

            this.Controls.Add(panelSuccess);
        }

        private void ShowPanel(Panel target)
        {
            panelSetup.Visible = (target == panelSetup);
            panelProgress.Visible = (target == panelProgress);
            panelSuccess.Visible = (target == panelSuccess);
        }

        private void StartInstallation()
        {
            finalInstallPath = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(finalInstallPath))
            {
                MessageBox.Show("Por favor, selecione uma pasta de instalação válida.", "Valore - Instalador", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            ShowPanel(panelProgress);

            Thread t = new Thread(() =>
            {
                try
                {
                    PerformExtraction();
                    CreateShortcuts();
                    RegisterUninstaller();
                    ConfigureFirewallRules();

                    this.Invoke((MethodInvoker)delegate
                    {
                        var lblPath = panelSuccess.Controls.Find("lblInfoPath", true);
                        if (lblPath.Length > 0) lblPath[0].Text = finalInstallPath;

                        ShowPanel(panelSuccess);

                        if (isAutoUpdateMode)
                        {
                            LaunchValoreExe();
                            Thread.Sleep(800);
                            Application.Exit();
                            return;
                        }

                        if (chkLaunchAfter.Checked)
                        {
                            LaunchValoreExe();
                        }
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show("Ocorreu um erro durante a instalação:\n" + ex.Message, "Erro na Instalação", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        ShowPanel(panelSetup);
                    });
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        private void PerformExtraction()
        {
            if (!Directory.Exists(finalInstallPath))
            {
                Directory.CreateDirectory(finalInstallPath);
            }

            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream zipStream = asm.GetManifestResourceStream("payload.zip"))
            {
                if (zipStream == null)
                {
                    throw new Exception("O pacote do aplicativo (payload.zip) não foi encontrado nos recursos embutidos.");
                }

                using (ZipArchive archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                {
                    int total = archive.Entries.Count;
                    int count = 0;

                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string destinationPath = Path.GetFullPath(Path.Combine(finalInstallPath, entry.FullName));

                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            // É um diretório
                            Directory.CreateDirectory(destinationPath);
                        }
                        else
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath));
                            
                            // Blindagem anti-bloqueio: até 10 tentativas com delay para arquivos liberarem handles
                            bool extracted = false;
                            Exception lastEx = null;
                            for (int retry = 0; retry < 10; retry++)
                            {
                                try
                                {
                                    entry.ExtractToFile(destinationPath, true);
                                    extracted = true;
                                    break;
                                }
                                catch (Exception ex)
                                {
                                    lastEx = ex;
                                    Thread.Sleep(300);
                                }
                            }

                            if (!extracted && lastEx != null)
                            {
                                throw new Exception("Falha ao sobrescrever o arquivo '" + entry.Name + "'. Ele está em uso por outro processo.\nDetalhes: " + lastEx.Message);
                            }
                        }

                        count++;
                        int pct = (int)((count / (float)total) * 100);

                        this.Invoke((MethodInvoker)delegate
                        {
                            progressBar.Value = Math.Min(100, Math.Max(0, pct));
                            lblProgressPercent.Text = pct + "%";
                            lblProgressDetail.Text = "Extraindo: " + entry.Name + " (" + count + "/" + total + ")";
                        });

                        // Pequeno delay sutil para renderização suave
                        if (count % 15 == 0) Thread.Sleep(8);
                    }
                }
            }

            this.Invoke((MethodInvoker)delegate
            {
                lblProgressDetail.Text = "Configurando atalhos e registros do sistema...";
                progressBar.Value = 100;
                lblProgressPercent.Text = "100%";
            });
            Thread.Sleep(300);
        }

        private void CreateShortcuts()
        {
            string exePath = Path.Combine(finalInstallPath, "Valore.exe");
            if (!File.Exists(exePath)) return;

            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;
            dynamic shell = Activator.CreateInstance(shellType);

            // Atalho na Área de Trabalho (suporta Desktop clássico e OneDrive Área de Trabalho)
            if (chkDesktopShortcut.Checked)
            {
                string desktopFolder = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                CreateShortcutInFolder(shell, desktopFolder, exePath);

                string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string oneDriveDesktopBr = Path.Combine(userProfile, "OneDrive", "Área de Trabalho");
                if (Directory.Exists(oneDriveDesktopBr) && !string.Equals(desktopFolder, oneDriveDesktopBr, StringComparison.OrdinalIgnoreCase))
                {
                    CreateShortcutInFolder(shell, oneDriveDesktopBr, exePath);
                }

                string oneDriveDesktopEn = Path.Combine(userProfile, "OneDrive", "Desktop");
                if (Directory.Exists(oneDriveDesktopEn) && !string.Equals(desktopFolder, oneDriveDesktopEn, StringComparison.OrdinalIgnoreCase))
                {
                    CreateShortcutInFolder(shell, oneDriveDesktopEn, exePath);
                }
            }

            // Atalho no Menu Iniciar
            if (chkStartMenuShortcut.Checked)
            {
                string startMenuFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs");
                CreateShortcutInFolder(shell, startMenuFolder, exePath);
            }
        }

        private void CreateShortcutInFolder(dynamic shell, string folder, string exePath)
        {
            try
            {
                if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
                string linkPath = Path.Combine(folder, "Valore - Gestão Financeira.lnk");
                dynamic sc = shell.CreateShortcut(linkPath);
                sc.TargetPath = exePath;
                sc.WorkingDirectory = Path.GetDirectoryName(exePath);
                sc.IconLocation = exePath + ",0";
                sc.Description = "Valore - Gestão Financeira Inteligente";
                sc.Save();
            }
            catch {}
        }

        private void ConfigureFirewallRules()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "netsh.exe",
                    Arguments = "advfirewall firewall add rule name=\"Valore Sync Server\" dir=in action=allow protocol=TCP localport=45454-45460 profile=any",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                using (Process p = Process.Start(psi))
                {
                    if (p != null) p.WaitForExit(3000);
                }
            }
            catch {}
        }

        private void RegisterUninstaller()
        {
            try
            {
                string exePath = Path.Combine(finalInstallPath, "Valore.exe");
                string uninstallerBat = Path.Combine(finalInstallPath, "Desinstalar Valore.bat");

                // Cria script oficial de desinstalação
                string uninstContent = "@echo off\r\n" +
                    "title Desinstalador - Valore Gestao Financeira\r\n" +
                    "echo ====================================================\r\n" +
                    "echo       Desinstalador do Valore\r\n" +
                    "echo ====================================================\r\n" +
                    "echo Tem certeza que deseja desinstalar o Valore do seu PC?\r\n" +
                    "echo Pressione qualquer tecla para confirmar ou feche a janela...\r\n" +
                    "pause > nul\r\n" +
                    "echo Removendo atalhos...\r\n" +
                    "del /q \"%USERPROFILE%\\Desktop\\Valore - Gestao Financeira.lnk\" 2>nul\r\n" +
                    "del /q \"%USERPROFILE%\\OneDrive\\Área de Trabalho\\Valore - Gestao Financeira.lnk\" 2>nul\r\n" +
                    "del /q \"%USERPROFILE%\\OneDrive\\Desktop\\Valore - Gestao Financeira.lnk\" 2>nul\r\n" +
                    "del /q \"%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Valore - Gestao Financeira.lnk\" 2>nul\r\n" +
                    "echo Removendo registros do Windows...\r\n" +
                    "reg delete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Valore\" /f 2>nul\r\n" +
                    "echo Removendo arquivos do aplicativo...\r\n" +
                    "timeout /t 2 /nobreak > nul\r\n" +
                    "cd /d \"%TEMP%\"\r\n" +
                    "rmdir /s /q \"" + finalInstallPath + "\"\r\n" +
                    "echo Valore foi desinstalado com sucesso do seu computador.\r\n" +
                    "pause\r\n";

                File.WriteAllText(uninstallerBat, uninstContent);

                // Registra no Painel de Controle (Configurações > Aplicativos Instalados)
                string uninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Valore";
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(uninstallKey))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "Valore - Gestão Financeira Inteligente");
                        key.SetValue("DisplayVersion", AppVersion);
                        key.SetValue("Publisher", "Valore Finanças");
                        key.SetValue("InstallLocation", finalInstallPath);
                        key.SetValue("DisplayIcon", exePath + ",0");
                        key.SetValue("UninstallString", "\"" + uninstallerBat + "\"");
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch {}
        }

        private void LaunchValoreExe()
        {
            try
            {
                string exePath = Path.Combine(finalInstallPath, "Valore.exe");
                if (File.Exists(exePath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(exePath);
                    psi.WorkingDirectory = finalInstallPath;
                    Process.Start(psi);
                }
            }
            catch {}
        }

        // Helpers de Estilização Moderna
        private Button CreateStyledButton(string text, int width, int height, Color normalColor, Color hoverColor, Color textColor, bool isPrimary = false)
        {
            Button btn = new Button
            {
                Text = text,
                Size = new Size(width, height),
                FlatStyle = FlatStyle.Flat,
                BackColor = normalColor,
                ForeColor = textColor,
                Font = new Font("Segoe UI", isPrimary ? 10f : 9.2f, isPrimary ? FontStyle.Bold : FontStyle.Regular),
                Cursor = Cursors.Hand
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.MouseEnter += (s, e) => btn.BackColor = hoverColor;
            btn.MouseLeave += (s, e) => btn.BackColor = normalColor;
            return btn;
        }

        private void KillRunningValoreProcesses()
        {
            try
            {
                Process current = Process.GetCurrentProcess();
                for (int attempt = 0; attempt < 8; attempt++)
                {
                    bool anyAlive = false;
                    foreach (string procName in new[] { "Valore" })
                    {
                        Process[] procs = Process.GetProcessesByName(procName);
                        foreach (Process p in procs)
                        {
                            if (p.Id != current.Id)
                            {
                                anyAlive = true;
                                try { p.Kill(); } catch {}
                            }
                        }
                    }
                    if (!anyAlive) break;
                    Thread.Sleep(300);
                }
            }
            catch {}
        }

        private void WaitForFilesToBeUnlocked(string installDir)
        {
            if (string.IsNullOrEmpty(installDir) || !Directory.Exists(installDir)) return;
            string[] criticalFiles = new[]
            {
                Path.Combine(installDir, "Valore.exe"),
                Path.Combine(installDir, "resources", "app.asar")
            };

            foreach (string filePath in criticalFiles)
            {
                if (!File.Exists(filePath)) continue;
                for (int attempt = 0; attempt < 12; attempt++)
                {
                    try
                    {
                        using (FileStream fs = new FileStream(filePath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
                        {
                            // Arquivo está totalmente livre
                            break;
                        }
                    }
                    catch
                    {
                        // Arquivo ainda bloqueado por processo em finalização, aguarda
                        Thread.Sleep(350);
                    }
                }
            }
        }

        private void DrawRoundedCard(Graphics g, Panel p, Color borderColor)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using (Pen pen = new Pen(borderColor, 1.2f))
            {
                g.DrawRectangle(pen, 0, 0, p.Width - 1, p.Height - 1);
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            bool autoUpdate = false;
            string explicitDir = null;
            if (args != null && args.Length > 0)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    string arg = args[i];
                    if (arg.Equals("--update", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("/update", StringComparison.OrdinalIgnoreCase) ||
                        arg.Equals("/silent", StringComparison.OrdinalIgnoreCase))
                    {
                        autoUpdate = true;
                    }
                    else if ((arg.Equals("--dir", StringComparison.OrdinalIgnoreCase) || arg.Equals("/dir", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
                    {
                        explicitDir = args[i + 1].Trim('\"', '\'');
                    }
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm(autoUpdate, explicitDir));
        }
    }
}
