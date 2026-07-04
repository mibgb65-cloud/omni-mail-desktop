param(
    [string] $ManifestPath = "build\installer\update-manifest.json",
    [string] $WailsConfigPath = (Join-Path $PSScriptRoot "..\wails.json")
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$manifestPath = Join-Path $root $ManifestPath
if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Error "Update manifest '$ManifestPath' was not found."
    exit 1
}

$config = Get-Content -Raw -LiteralPath $WailsConfigPath | ConvertFrom-Json
$version = [string] $config.info.productVersion
$expectedTag = "v$version"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

if ([string] $manifest.version -ne $version) {
    Write-Error "Manifest version '$($manifest.version)' does not match productVersion '$version'."
    exit 1
}
if ([string] $manifest.tag -ne $expectedTag) {
    Write-Error "Manifest tag '$($manifest.tag)' does not match expected '$expectedTag'."
    exit 1
}
if ([string]::IsNullOrWhiteSpace([string] $manifest.channel)) {
    Write-Error "Manifest channel is required."
    exit 1
}
if ([string]::IsNullOrWhiteSpace([string] $manifest.installer.name)) {
    Write-Error "Manifest installer.name is required."
    exit 1
}

$installerPath = Join-Path (Split-Path -Parent $manifestPath) ([string] $manifest.installer.name)
if (-not (Test-Path -LiteralPath $installerPath)) {
    Write-Error "Manifest installer '$($manifest.installer.name)' was not found."
    exit 1
}

$installer = Get-Item -LiteralPath $installerPath
if ([int64] $manifest.installer.size -ne $installer.Length) {
    Write-Error "Manifest installer size '$($manifest.installer.size)' does not match '$($installer.Length)'."
    exit 1
}

$expectedUrl = "https://github.com/mibgb65-cloud/omni-mail-desktop/releases/download/$expectedTag/$($installer.Name)"
if ([string] $manifest.installer.url -ne $expectedUrl) {
    Write-Error "Manifest installer URL '$($manifest.installer.url)' does not match '$expectedUrl'."
    exit 1
}

$hash = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ([string] $manifest.installer.sha256 -ne $hash) {
    Write-Error "Manifest SHA256 '$($manifest.installer.sha256)' does not match '$hash'."
    exit 1
}

$checksumPath = "$($installer.FullName).sha256"
if (-not (Test-Path -LiteralPath $checksumPath)) {
    Write-Error "Installer checksum '$checksumPath' was not found."
    exit 1
}
$checksumHash = ((Get-Content -Raw -LiteralPath $checksumPath) -split "\s+")[0].ToLowerInvariant()
if ($checksumHash -ne $hash) {
    Write-Error "Checksum file SHA256 '$checksumHash' does not match '$hash'."
    exit 1
}

Write-Host "Update manifest check passed for $expectedTag."
