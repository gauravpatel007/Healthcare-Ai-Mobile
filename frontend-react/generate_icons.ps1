Add-Type -AssemblyName System.Drawing

$srcPath = (Resolve-Path "dist\cardiogram.png").Path
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($img, $width, $height, $outPath) {
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $destImg = New-Object System.Drawing.Bitmap($width, $height)
    $destImg.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, $destRect, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $destImg.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destImg.Dispose()
    Write-Output "Created: $outPath ($width x $height)"
}

function Create-Foreground($img, $canvasSize, $outPath) {
    # Safe zone for adaptive icons foreground is ~66-72%
    $iconSize = [int]($canvasSize * 0.70)
    $offset = [int](($canvasSize - $iconSize) / 2)
    $destRect = New-Object System.Drawing.Rectangle($offset, $offset, $iconSize, $iconSize)
    $destImg = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
    $destImg.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, $destRect, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $destImg.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destImg.Dispose()
    Write-Output "Created: $outPath ($canvasSize x $canvasSize)"
}

$resDir = (Resolve-Path "android\app\src\main\res").Path

$densities = @(
    @{ Name = "mipmap-mdpi";    Icon = 48;  Fg = 108 },
    @{ Name = "mipmap-hdpi";    Icon = 72;  Fg = 162 },
    @{ Name = "mipmap-xhdpi";   Icon = 96;  Fg = 216 },
    @{ Name = "mipmap-xxhdpi";  Icon = 144; Fg = 324 },
    @{ Name = "mipmap-xxxhdpi"; Icon = 192; Fg = 432 }
)

foreach ($d in $densities) {
    $targetDir = Join-Path $resDir $d.Name
    
    # 1. Standard icon
    $iconPath = Join-Path $targetDir "ic_launcher.png"
    Resize-Image $srcImg $d.Icon $d.Icon $iconPath
    
    # 2. Round icon
    $roundPath = Join-Path $targetDir "ic_launcher_round.png"
    Resize-Image $srcImg $d.Icon $d.Icon $roundPath
    
    # 3. Foreground adaptive icon
    $fgPath = Join-Path $targetDir "ic_launcher_foreground.png"
    Create-Foreground $srcImg $d.Fg $fgPath
}

$srcImg.Dispose()
Write-Output "Successfully updated all Android launcher icons!"
