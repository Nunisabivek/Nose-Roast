
Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\nunis\.gemini\antigravity\brain\97a565f7-d381-4c86-a048-698300dca0ad\nose_roast_final_feature_1768026457985.png"
$destPath = "C:\Users\nunis\Downloads\feature_graphic_1024x500.png"

# 1. Load Image
if (-not (Test-Path $sourcePath)) { Write-Host "Error: Source image not found."; exit }
$image = [System.Drawing.Image]::FromFile($sourcePath)

# 2. Dimensions
$tWidth = 1024
$tHeight = 500
$srcW = $image.Width
$srcH = $image.Height

# 3. Create Target Bitmap (Strictly 1024x500)
$bmp = New-Object System.Drawing.Bitmap($tWidth, $tHeight)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# 4. Crop Logic
# If source is 1024x1024, we take the CENTER strip.
# If source is smaller/larger, we resize to width 1024 first, then crop center.

# Calculate Scale to fit Width = 1024
$scale = $tWidth / $srcW
$renderH = $srcH * $scale
$yOffset = ($renderH - $tHeight) / 2

# Draw Image (Scaled to width 1024, shifted up by yOffset to center vertically)
$destRect = New-Object System.Drawing.Rectangle(0, 0, $tWidth, $tHeight)
$srcRect = New-Object System.Drawing.Rectangle(0, $yOffset / $scale, $srcW, $tHeight / $scale)

$g.DrawImage($image, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

# 5. Save directly to Downloads
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "Success: $destPath"

$image.Dispose()
$bmp.Dispose()
$g.Dispose()
