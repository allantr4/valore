param(
    [string]$TagName = "",
    [string]$ReleaseName = "",
    [switch]$Overwrite = $false
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Publicador Automatizado de Releases - Valore       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 0. Lê dados dinâmicos do version.json
$verData = Get-Content "version.json" -Raw | ConvertFrom-Json
$currentVersion = $verData.version
$cleanVer = $currentVersion.Replace(".", "")

if (-not $TagName) {
    $TagName = "v$currentVersion"
}
if (-not $ReleaseName) {
    $ReleaseName = if ($verData.title) { $verData.title } else { "Valore v$currentVersion" }
}

Write-Host "Versão Alvo: $TagName ($ReleaseName)" -ForegroundColor Green

# 1. Obter token do Git Credential Manager com fallback robusto
$token = (node "$PSScriptRoot\get_github_token.js").Trim()

if (-not $token) {
    Write-Error "Token de acesso do GitHub nao encontrado no Git Credential Manager."
    exit 1
}

$headers = @{
    "Authorization" = "token $token"
    "User-Agent" = "Valore-Release-Bot"
    "Accept" = "application/vnd.github.v3+json"
}

# 2. Obter ou Criar Release no GitHub
Write-Host "`n[1/3] Verificando Release '$TagName' no repositorio allantr4/valore..." -ForegroundColor Yellow
$release = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases/tags/$TagName" -Headers $headers -Method Get
    Write-Host "Release '$TagName' ja existe (ID: $($release.id))." -ForegroundColor Green
} catch {
    Write-Host "Criando nova Release '$TagName'..." -ForegroundColor Yellow
    $notesFormatted = ($verData.notes | ForEach-Object { "- $_" }) -join "`n"
    $bodyText = "# $($verData.title)`n`n### Destaques desta Versao:`n$notesFormatted`n`n### Downloads Disponiveis:`n- **Desktop Windows (Versionado):** [Instalador_Valore_Financeiro_$cleanVer.exe](https://github.com/allantr4/valore/releases/download/$TagName/Instalador_Valore_Financeiro_$cleanVer.exe)`n- **Mobile Android (Versionado):** [Valore_$cleanVer.apk](https://github.com/allantr4/valore/releases/download/$TagName/Valore_$cleanVer.apk)`n- **Desktop Windows (Padrao):** [Instalador Valore Financeiro.exe](https://github.com/allantr4/valore/releases/download/$TagName/Instalador%20Valore%20Financeiro.exe)`n- **Mobile Android (Padrao):** [Valore.apk](https://github.com/allantr4/valore/releases/download/$TagName/Valore.apk)`n"
    
    $payloadObj = @{
        tag_name = $TagName
        name = $ReleaseName
        body = $bodyText
        draft = $false
        prerelease = $false
    }
    $payloadJson = [System.Text.Encoding]::UTF8.GetBytes(($payloadObj | ConvertTo-Json))
    
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases" -Method Post -Headers $headers -Body $payloadJson -ContentType "application/json; charset=utf-8"
    Write-Host "Release criada com sucesso! (ID: $($release.id))" -ForegroundColor Green
}

# Função auxiliar de upload com verificação
function Upload-ReleaseAsset([string]$filePath, [string]$contentType) {
    if (-not (Test-Path $filePath)) {
        Write-Warning "Arquivo nao encontrado para upload: $filePath"
        return
    }

    $fileName = [System.IO.Path]::GetFileName($filePath)
    $normalizedName = $fileName.Replace(" ", ".")
    $encodedName = [System.Uri]::EscapeDataString($fileName)
    $uploadUri = "https://uploads.github.com/repos/allantr4/valore/releases/$($release.id)/assets?name=$encodedName"

    $currentRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases/$($release.id)" -Headers $headers -Method Get
    $existing = $currentRelease.assets | Where-Object { $_.name -eq $fileName -or $_.name -eq $normalizedName }

    if ($existing -and $Overwrite) {
        Write-Host "Asset '$fileName' existente detectado (ID: $($existing.id)). Removendo para atualizar com o novo binario..." -ForegroundColor Yellow
        try {
            Invoke-RestMethod -Uri "https://api.github.com/repos/allantr4/valore/releases/assets/$($existing.id)" -Headers $headers -Method Delete
            Start-Sleep -Seconds 2
            $existing = $null
        } catch {
            Write-Host "Falha ao remover asset antigo: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    if ($existing) {
        Write-Host "Asset '$fileName' ja existe na release (ID: $($existing.id))." -ForegroundColor Gray
        Write-Host "Link direto: $($existing.browser_download_url)" -ForegroundColor Cyan
    } else {
        $fileSizeMB = [math]::Round(((Get-Item $filePath).Length / 1MB), 2)
        Write-Host "Enviando '$fileName' ($fileSizeMB MB) para o GitHub... Aguarde..." -ForegroundColor Yellow

        $uploadHeaders = @{
            "Authorization" = "token $token"
            "User-Agent" = "Valore-Release-Bot"
            "Content-Type" = $contentType
        }

        $maxRetries = 3
        $attempt = 0
        $success = $false

        while (-not $success -and $attempt -lt $maxRetries) {
            $attempt++
            try {
                $asset = Invoke-RestMethod -Uri $uploadUri -Method Post -Headers $uploadHeaders -InFile $filePath -TimeoutSec 1200
                $success = $true
                Write-Host "Upload de '$fileName' concluido com sucesso!" -ForegroundColor Green
                Write-Host "Link direto: $($asset.browser_download_url)" -ForegroundColor Cyan
            } catch {
                Write-Host "Tentativa $attempt falhou para '$fileName': $_. Mensagem: $($_.Exception.Message)" -ForegroundColor Red
                if ($attempt -lt $maxRetries) {
                    Write-Host "Aguardando 5 segundos antes de tentar novamente..." -ForegroundColor Yellow
                    Start-Sleep -Seconds 5
                } else {
                    throw $_
                }
            }
        }
    }
}

# 3. Upload dos Instaladores Desktop Windows
Write-Host "`n[2/3] Processando upload dos Instaladores Desktop Windows..." -ForegroundColor Yellow
Upload-ReleaseAsset "E:\Gestor Financeiro\Instalador\Instalador_Valore_Financeiro_$cleanVer.exe" "application/octet-stream"
Upload-ReleaseAsset "E:\Gestor Financeiro\Instalador\Instalador Valore Financeiro.exe" "application/octet-stream"

# 4. Upload dos APKs Android
Write-Host "`n[3/3] Processando upload dos APKs Mobile Android..." -ForegroundColor Yellow
Upload-ReleaseAsset "E:\Gestor Financeiro\Android\Valore_$cleanVer.apk" "application/vnd.android.package-archive"
Upload-ReleaseAsset "E:\Gestor Financeiro\Android\Valore.apk" "application/vnd.android.package-archive"

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "   Publicacao da Release concluida com Sucesso!       " -ForegroundColor Green
Write-Host "   Pagina da Release: https://github.com/allantr4/valore/releases/tag/$TagName" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green
