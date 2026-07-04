$ErrorActionPreference = "Stop"

$limit = 600
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$rootPath = $root.Path.TrimEnd("\")
$extensions = @(".go", ".js", ".jsx", ".css", ".ps1")
$excludedDirs = @(
    ".git",
    ".gocache",
    "build",
    "frontend\dist",
    "frontend\node_modules",
    "frontend\src\assets",
    "frontend\wailsjs"
)

function Test-IsExcludedPath {
    param([string] $RelativePath)

    foreach ($dir in $excludedDirs) {
        if ($RelativePath -eq $dir -or $RelativePath.StartsWith("$dir\")) {
            return $true
        }
    }

    return $false
}

$violations = @()
Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($rootPath.Length + 1)
    if (Test-IsExcludedPath $relativePath) {
        return
    }

    if ($extensions -notcontains $_.Extension) {
        return
    }

    $lineCount = (Get-Content -LiteralPath $_.FullName).Count
    if ($lineCount -gt $limit) {
        $violations += [PSCustomObject]@{
            Lines = $lineCount
            Path = $relativePath
        }
    }
}

if ($violations.Count -gt 0) {
    $violations |
        Sort-Object -Property Lines -Descending |
        ForEach-Object { Write-Error "$($_.Path) has $($_.Lines) lines; limit is $limit." }
    exit 1
}

Write-Host "Line limit check passed: source files are at or below $limit lines."
