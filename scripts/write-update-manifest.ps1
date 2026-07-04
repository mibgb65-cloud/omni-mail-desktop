param(
    [string] $InstallerPattern = "build\installer\OmniMailDesktop-Setup-*.exe",
    [string] $WailsConfigPath = (Join-Path $PSScriptRoot "..\wails.json"),
    [string] $ChangelogPath = (Join-Path $PSScriptRoot "..\CHANGELOG.md"),
    [string] $OutputPath = "",
    [string] $Channel = "stable",
    [string] $MinVersion = "1.0.7",
    [switch] $Mandatory
)

$ErrorActionPreference = "Stop"

function Get-ChangelogSection {
    param(
        [string] $Tag,
        [string] $Path
    )

    $lines = @(Get-Content -LiteralPath $Path)
    $headingPattern = "^##\s+\[$([regex]::Escape($Tag))\]\s+-\s+"
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i += 1) {
        if ($lines[$i] -match $headingPattern) {
            $start = $i
            break
        }
    }
    if ($start -lt 0) {
        return ""
    }

    $end = $lines.Count
    for ($i = $start + 1; $i -lt $lines.Count; $i += 1) {
        if ($lines[$i] -match "^##\s+\[") {
            $end = $i
            break
        }
    }

    return ($lines[$start..($end - 1)] -join [Environment]::NewLine).Trim()
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$config = Get-Content -Raw -LiteralPath $WailsConfigPath | ConvertFrom-Json
$version = [string] $config.info.productVersion
$tag = "v$version"
$pattern = Join-Path $root $InstallerPattern
$installer = @(Get-ChildItem -Path $pattern -File | Sort-Object -Property LastWriteTimeUtc -Descending | Select-Object -First 1)
if ($installer.Count -eq 0) {
    Write-Error "No installer matched '$InstallerPattern'."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $installer[0].DirectoryName "update-manifest.json"
}

$hash = Get-FileHash -LiteralPath $installer[0].FullName -Algorithm SHA256
$downloadUrl = "https://github.com/mibgb65-cloud/omni-mail-desktop/releases/download/$tag/$($installer[0].Name)"
$manifest = [ordered] @{
    version         = $version
    tag             = $tag
    channel         = $Channel
    minVersion      = $MinVersion
    mandatory       = [bool] $Mandatory
    blockedVersions = @()
    installer       = [ordered] @{
        name   = $installer[0].Name
        url    = $downloadUrl
        sha256 = $hash.Hash.ToLowerInvariant()
        size   = $installer[0].Length
    }
    notes           = Get-ChangelogSection -Tag $tag -Path $ChangelogPath
    publishedAt     = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Host "Wrote update manifest to $OutputPath"
