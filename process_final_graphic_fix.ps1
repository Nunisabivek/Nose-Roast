
Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\nunis\.gemini\antigravity\brain\97a565f7-d381-4c86-a048-698300dca0ad\nose_roast_final_feature_1768026457985.png"
$destPath = "C:\Users\nunis\Downloads\feature_graphic_1024x500.png"

# 1. Load Image
if (-not (Test-Path $sourcePath)) { Write-Host "Error: Source image not found."; exit }
$image = [System.Drawing.Image]::FromFile($sourcePath)

$tWidth = 1024
$tHeight = 500
$srcW = $image.Width
$srcH = $image.Height

Write-Host "Source Dimensions: $srcW x $srcH"

# 2. Creates Target Bitmap
$bmp = New-Object System.Drawing.Bitmap($tWidth, $tHeight)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(15, 23, 42)) # Fill with dark slate just in case

# 3. Calculate Crop (Center-Center)
# We assume source is 1024 width. If not, we scale.
$scale = $tWidth / $srcW  
# PowerShell can be tricky with types, force [double] for math, [int] for Rectangle
$renderW = [int]($srcW * $scale)
$renderH = [int]($srcH * $scale)

# Shift up to center vertically
$yOffset = [int](($tHeight - $renderH) / 2)

Write-Host "Drawing image at 0, $yOffset with size $renderW x $renderH"

# 4. Draw
# DrawImage(Image, X, Y, Width, Height) is the safest simple overload
$g.DrawImage($image, 0, $yOffset, $renderW, $renderH)

# 5. Save
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "Fixed graphics generation. Saved to: $destPath"

$image.Dispose()
$bmp.Dispose()
$g.Dispose()
