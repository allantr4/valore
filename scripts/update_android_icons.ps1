Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\allan\OneDrive\Pictures\APP Valore\Icones\Icone_Valore_HD.png"
if (-not (Test-Path $srcPath)) {
    Write-Error "Arquivo fonte nao encontrado: $srcPath"
    exit 1
}

$srcImage = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "Imagem fonte carregada: $($srcImage.Width)x$($srcImage.Height)" -ForegroundColor Cyan

function Resize-And-Save($targetWidth, $targetHeight, $destPath) {
    $parent = Split-Path -Parent $destPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    
    $destBitmap = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    
    $graphics.DrawImage($srcImage, 0, 0, $targetWidth, $targetHeight)
    $graphics.Dispose()
    
    if (Test-Path $destPath) {
        Remove-Item $destPath -Force
    }
    $destBitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    Write-Host "Gerado: $destPath ($($targetWidth)x$($targetHeight))" -ForegroundColor Green
}

$resDir = "E:\Gestor Financeiro\Android\android\app\src\main\res"

# Mipmap standard launcher icons (48, 72, 96, 144, 192)
Resize-And-Save 48 48 "$resDir\mipmap-mdpi\ic_launcher.png"
Resize-And-Save 48 48 "$resDir\mipmap-mdpi\ic_launcher_round.png"
Resize-And-Save 108 108 "$resDir\mipmap-mdpi\ic_launcher_foreground.png"

Resize-And-Save 72 72 "$resDir\mipmap-hdpi\ic_launcher.png"
Resize-And-Save 72 72 "$resDir\mipmap-hdpi\ic_launcher_round.png"
Resize-And-Save 162 162 "$resDir\mipmap-hdpi\ic_launcher_foreground.png"

Resize-And-Save 96 96 "$resDir\mipmap-xhdpi\ic_launcher.png"
Resize-And-Save 96 96 "$resDir\mipmap-xhdpi\ic_launcher_round.png"
Resize-And-Save 216 216 "$resDir\mipmap-xhdpi\ic_launcher_foreground.png"

Resize-And-Save 144 144 "$resDir\mipmap-xxhdpi\ic_launcher.png"
Resize-And-Save 144 144 "$resDir\mipmap-xxhdpi\ic_launcher_round.png"
Resize-And-Save 324 324 "$resDir\mipmap-xxhdpi\ic_launcher_foreground.png"

Resize-And-Save 192 192 "$resDir\mipmap-xxxhdpi\ic_launcher.png"
Resize-And-Save 192 192 "$resDir\mipmap-xxxhdpi\ic_launcher_round.png"
Resize-And-Save 432 432 "$resDir\mipmap-xxxhdpi\ic_launcher_foreground.png"

# Copiar também para o web assets do mobile
Resize-And-Save 512 512 "E:\Gestor Financeiro\Android\www\assets\logo_mobile_hd.png"
Resize-And-Save 192 192 "E:\Gestor Financeiro\Android\www\assets\icon_192.png"
Resize-And-Save 512 512 "E:\Gestor Financeiro\Android\www\assets\icon_512.png"

$srcImage.Dispose()
Write-Host "Todos os icones Android gerados com sucesso!" -ForegroundColor Cyan

