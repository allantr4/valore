param(
    [string]$TagName = "v1.0.0",
    [string]$ReleaseName = "Valore v1.0.0 - Versão Oficial Multiplataforma"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   💎 Publicador Automatizado de Releases - Valore    " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Obter token do Git Credential Manager
$git = "C:\Program Files\Git\cmd\git.exe"
$inputCred = "protocol=https`nhost=github.com`n`n"
$outputCred = $inputCred | & $git credential fill
$token = ""
foreach ($line in $outputCred) {
    if ($line -like "password=*") {
        $token = $line.Substring(9)
    }
}

if (-not $token) {
    Write-Error "Token de acesso do GitHub não encontrado no Git Credential Manager."
    exit 1
}

$headers = @{
    "Authorization" = "token $token"
    "User-Agent" = "Valore-Release-Bot"
    "Accept" = "application/vnd.github.v3+json"
}

# 2. Obter ou Criar Release no GitHub
Write-Host "`n[1/3] Verificando Release '$TagName' no repositório allantr4/valore..." -ForegroundColor Yellow
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases/tags/$TagName" -Headers $headers -Method Get
    Write-Host "Release '$TagName' já existe (ID: $($release.id))." -ForegroundColor Green
} catch {
    Write-Host "Criando nova Release '$TagName'..." -ForegroundColor Yellow
    $verData = Get-Content "version.json" -Raw | ConvertFrom-Json
    $notesFormatted = ($verData.notes | ForEach-Object { "- $_" }) -join "`n"
    $bodyText = "# 💎 $($verData.title)`n`n### 🌟 Destaques desta Versão:`n$notesFormatted`n`n### 📦 Downloads Disponíveis:`n- **Desktop Windows (Instalador Oficial):** [Instalador Valore Financeiro.exe](https://github.com/allantr4/valore/releases/download/$TagName/Instalador%20Valore%20Financeiro.exe)`n- **Mobile Android (APK Direto):** [Valore.apk](https://github.com/allantr4/valore/releases/download/$TagName/Valore.apk)`n"
    
    $payloadObj = @{
        tag_name = $TagName
        name = if ($ReleaseName -ne "Valore v1.0.0 - Versão Oficial Multiplataforma") { $ReleaseName } else { $verData.title }
        body = $bodyText
        draft = $false
        prerelease = $false
    }
    $payloadJson = [System.Text.Encoding]::UTF8.GetBytes(($payloadObj | ConvertTo-Json))
    
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases" -Method Post -Headers $headers -Body $payloadJson -ContentType "application/json; charset=utf-8"
    Write-Host "Release criada com sucesso! (ID: $($release.id))" -ForegroundColor Green
}

# 3. Upload do Instalador Desktop Windows
Write-Host "`n[2/3] Processando upload do Instalador Desktop Windows..." -ForegroundColor Yellow
$installerPath = "E:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe"
if (Test-Path $installerPath) {
    $installerName = [System.IO.Path]::GetFileName($installerPath)
    $encodedName = [System.Uri]::EscapeDataString($installerName)
    $uploadUri = "https://uploads.github.com/repos/allantr4/valore/releases/$($release.id)/assets?name=$encodedName"
    
    # Atualizar lista de assets atuais da release
    $currentRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases/$($release.id)" -Headers $headers -Method Get
    $existing = $currentRelease.assets | Where-Object { $_.name -eq $installerName }
    
    if ($existing) {
        Write-Host "Asset '$installerName' já existe na release (ID: $($existing.id))." -ForegroundColor Gray
        Write-Host "Link direto: $($existing.browser_download_url)" -ForegroundColor Cyan
    } else {
        $fileSizeMB = [math]::Round(((Get-Item $installerPath).Length / 1MB), 2)
        Write-Host "Enviando '$installerName' ($fileSizeMB MB) para o GitHub... Aguarde..." -ForegroundColor Yellow
        
        $uploadHeaders = @{
            "Authorization" = "token $token"
            "User-Agent" = "Valore-Release-Bot"
            "Content-Type" = "application/octet-stream"
        }
        $asset = Invoke-RestMethod -Uri $uploadUri -Method Post -Headers $uploadHeaders -InFile $installerPath -TimeoutSec 900
        Write-Host "Upload de '$installerName' concluído com sucesso!" -ForegroundColor Green
        Write-Host "Link direto: $($asset.browser_download_url)" -ForegroundColor Cyan
    }
} else {
    Write-Warning "Arquivo não encontrado: $installerPath"
}

# 4. Upload do APK Android
Write-Host "`n[3/3] Processando upload do APK Android..." -ForegroundColor Yellow
$apkPath = "E:\Gestor Financeiro\Android\Valore.apk"
if (Test-Path $apkPath) {
    $apkName = [System.IO.Path]::GetFileName($apkPath)
    $encodedName = [System.Uri]::EscapeDataString($apkName)
    $uploadUri = "https://uploads.github.com/repos/allantr4/valore/releases/$($release.id)/assets?name=$encodedName"
    
    $currentRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases/$($release.id)" -Headers $headers -Method Get
    $existingApk = $currentRelease.assets | Where-Object { $_.name -eq $apkName }
    
    if ($existingApk) {
        Write-Host "Asset '$apkName' já existe na release (ID: $($existingApk.id))." -ForegroundColor Gray
        Write-Host "Link direto: $($existingApk.browser_download_url)" -ForegroundColor Cyan
    } else {
        $fileSizeMB = [math]::Round(((Get-Item $apkPath).Length / 1MB), 2)
        Write-Host "Enviando '$apkName' ($fileSizeMB MB) para o GitHub... Aguarde..." -ForegroundColor Yellow
        
        $uploadHeaders = @{
            "Authorization" = "token $token"
            "User-Agent" = "Valore-Release-Bot"
            "Content-Type" = "application/vnd.android.package-archive"
        }
        $assetApk = Invoke-RestMethod -Uri $uploadUri -Method Post -Headers $uploadHeaders -InFile $apkPath -TimeoutSec 600
        Write-Host "Upload de '$apkName' concluído com sucesso!" -ForegroundColor Green
        Write-Host "Link direto: $($assetApk.browser_download_url)" -ForegroundColor Cyan
    }
} else {
    Write-Warning "Arquivo não encontrado: $apkPath"
}

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "   🎉 Publicação da Release concluída com Sucesso!    " -ForegroundColor Green
Write-Host "   Página da Release: https://github.com/allantr4/valore/releases/tag/$TagName" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green

