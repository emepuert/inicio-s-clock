Add-Type -AssemblyName System.Drawing

function New-Icon {
  param(
    [int]$Size,
    [string]$Path,
    [string]$Bg,
    [string]$Fg
  )
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml($Bg))
  $w = [Math]::Max(2, [int]($Size / 16))
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Fg)), $w
  $cx = $Size / 2.0
  $cy = $Size / 2.0
  $r = $Size * 0.32
  $g.DrawEllipse($pen, [float]($cx - $r), [float]($cy - $r), [float](2 * $r), [float](2 * $r))
  $g.DrawLine($pen, [float]$cx, [float]$cy, [float]$cx, [float]($cy - $r * 0.55))
  $g.DrawLine($pen, [float]$cx, [float]$cy, [float]($cx + $r * 0.45), [float]$cy)
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$public = Join-Path $projectRoot "public"
New-Icon -Size 192 -Path (Join-Path $public "icon-192.png") -Bg "#260806" -Fg "#f1ff33"
New-Icon -Size 512 -Path (Join-Path $public "icon-512.png") -Bg "#260806" -Fg "#f1ff33"
Write-Host "OK"
