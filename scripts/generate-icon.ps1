param(
    [string]$PngPath = "build/appicon.png",
    [string]$IcoPath = "build/windows/icon.ico"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-Color {
    param([int]$A, [int]$R, [int]$G, [int]$B)
    return [System.Drawing.Color]::FromArgb($A, $R, $G, $B)
}

function Add-RoundedRect {
    param(
        [System.Drawing.Drawing2D.GraphicsPath]$Path,
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $Path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $Path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $Path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $Path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $Path.CloseFigure()
}

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    Add-RoundedRect -Path $path -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
    return $path
}

function Draw-Icon {
    param([int]$Size)

    $scale = $Size / 1024.0
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $bgPath = New-RoundedRectPath -X (86 * $scale) -Y (86 * $scale) -Width (852 * $scale) -Height (852 * $scale) -Radius (204 * $scale)
    $bgRect = [System.Drawing.RectangleF]::new(86 * $scale, 86 * $scale, 852 * $scale, 852 * $scale)
    $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $bgRect,
        (New-Color 255 9 22 39),
        (New-Color 255 18 71 91),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $graphics.FillPath($bgBrush, $bgPath)

    $glowPath = New-RoundedRectPath -X (108 * $scale) -Y (108 * $scale) -Width (808 * $scale) -Height (808 * $scale) -Radius (184 * $scale)
    $glowPen = [System.Drawing.Pen]::new((New-Color 95 45 212 191), [Math]::Max(2, 18 * $scale))
    $graphics.DrawPath($glowPen, $glowPath)

    $orbitPen = [System.Drawing.Pen]::new((New-Color 255 45 212 191), [Math]::Max(2, 62 * $scale))
    $orbitPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $orbitPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawArc($orbitPen, 178 * $scale, 206 * $scale, 668 * $scale, 612 * $scale, 210, 266)

    $orbitPen2 = [System.Drawing.Pen]::new((New-Color 220 125 211 252), [Math]::Max(1, 24 * $scale))
    $orbitPen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $orbitPen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawArc($orbitPen2, 232 * $scale, 258 * $scale, 560 * $scale, 508 * $scale, 24, 78)

    $dotBrush = [System.Drawing.SolidBrush]::new((New-Color 255 248 250 252))
    $graphics.FillEllipse($dotBrush, 768 * $scale, 254 * $scale, 84 * $scale, 84 * $scale)
    $dotInner = [System.Drawing.SolidBrush]::new((New-Color 255 45 212 191))
    $graphics.FillEllipse($dotInner, 790 * $scale, 276 * $scale, 40 * $scale, 40 * $scale)

    $shadowPath = New-RoundedRectPath -X (254 * $scale) -Y (384 * $scale) -Width (516 * $scale) -Height (336 * $scale) -Radius (58 * $scale)
    $shadowBrush = [System.Drawing.SolidBrush]::new((New-Color 70 0 0 0))
    $graphics.TranslateTransform(0, 26 * $scale)
    $graphics.FillPath($shadowBrush, $shadowPath)
    $graphics.ResetTransform()

    $mailPath = New-RoundedRectPath -X (242 * $scale) -Y (360 * $scale) -Width (540 * $scale) -Height (346 * $scale) -Radius (62 * $scale)
    $mailBrush = [System.Drawing.SolidBrush]::new((New-Color 255 248 250 252))
    $graphics.FillPath($mailBrush, $mailPath)

    $mailEdgePen = [System.Drawing.Pen]::new((New-Color 255 203 213 225), [Math]::Max(1, 14 * $scale))
    $graphics.DrawPath($mailEdgePen, $mailPath)

    $foldPen = [System.Drawing.Pen]::new((New-Color 255 15 35 56), [Math]::Max(1, 30 * $scale))
    $foldPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $foldPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($foldPen, 282 * $scale, 404 * $scale, 512 * $scale, 570 * $scale)
    $graphics.DrawLine($foldPen, 742 * $scale, 404 * $scale, 512 * $scale, 570 * $scale)

    $lowerFoldPen = [System.Drawing.Pen]::new((New-Color 220 15 35 56), [Math]::Max(1, 22 * $scale))
    $lowerFoldPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $lowerFoldPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($lowerFoldPen, 294 * $scale, 660 * $scale, 448 * $scale, 534 * $scale)
    $graphics.DrawLine($lowerFoldPen, 730 * $scale, 660 * $scale, 576 * $scale, 534 * $scale)

    $graphics.Dispose()
    $bgBrush.Dispose()
    $bgPath.Dispose()
    $glowPath.Dispose()
    $glowPen.Dispose()
    $orbitPen.Dispose()
    $orbitPen2.Dispose()
    $dotBrush.Dispose()
    $dotInner.Dispose()
    $shadowPath.Dispose()
    $shadowBrush.Dispose()
    $mailPath.Dispose()
    $mailBrush.Dispose()
    $mailEdgePen.Dispose()
    $foldPen.Dispose()
    $lowerFoldPen.Dispose()

    return $bitmap
}

function Save-Png {
    param(
        [int]$Size,
        [string]$Path
    )

    $dir = Split-Path -Parent $Path
    if ($dir) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    $bitmap = Draw-Icon -Size $Size
    try {
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $bitmap.Dispose()
    }
}

function Get-PngBytes {
    param([int]$Size)

    $bitmap = Draw-Icon -Size $Size
    $stream = [System.IO.MemoryStream]::new()
    try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        return ,$stream.ToArray()
    }
    finally {
        $stream.Dispose()
        $bitmap.Dispose()
    }
}

function Write-Ico {
    param([string]$Path)

    $dir = Split-Path -Parent $Path
    if ($dir) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $images = foreach ($size in $sizes) {
        [pscustomobject]@{
            Size = $size
            Data = [byte[]](Get-PngBytes -Size $size)
        }
    }

    $file = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    $writer = [System.IO.BinaryWriter]::new($file)
    try {
        $writer.Write([UInt16]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]$images.Count)

        $offset = 6 + (16 * $images.Count)
        foreach ($image in $images) {
            $width = if ($image.Size -eq 256) { 0 } else { $image.Size }
            $height = if ($image.Size -eq 256) { 0 } else { $image.Size }
            $writer.Write([byte]$width)
            $writer.Write([byte]$height)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([UInt16]1)
            $writer.Write([UInt16]32)
            $writer.Write([UInt32]$image.Data.Length)
            $writer.Write([UInt32]$offset)
            $offset += $image.Data.Length
        }

        foreach ($image in $images) {
            $writer.Write($image.Data)
        }
    }
    finally {
        $writer.Dispose()
        $file.Dispose()
    }
}

Save-Png -Size 1024 -Path $PngPath
Write-Ico -Path $IcoPath
Write-Host "Generated $PngPath and $IcoPath"
