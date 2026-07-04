param(
    [string] $Tag = $env:GITHUB_REF_NAME,
    [string] $WailsConfigPath = (Join-Path $PSScriptRoot "..\wails.json"),
    [string] $ChangelogPath = (Join-Path $PSScriptRoot "..\CHANGELOG.md")
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Tag) -and $env:GITHUB_REF -match "^refs/tags/(v.+)$") {
    $Tag = $Matches[1]
}

$config = Get-Content -Raw -LiteralPath $WailsConfigPath | ConvertFrom-Json
$version = [string] $config.info.productVersion
if ($version -notmatch "^\d+\.\d+\.\d+(\.\d+)?$") {
    Write-Error "wails.json productVersion '$version' is not a release version."
    exit 1
}

$expectedTag = "v$version"
if ($Tag -like "v*" -and $Tag -ne $expectedTag) {
    Write-Error "Tag '$Tag' does not match wails.json productVersion '$version'. Expected '$expectedTag'."
    exit 1
}

$changelog = Get-Content -Raw -LiteralPath $ChangelogPath
$headingPattern = "(?m)^##\s+\[$([regex]::Escape($expectedTag))\]\s+-\s+"
if ($changelog -notmatch $headingPattern) {
    Write-Error "CHANGELOG.md does not contain a release section for $expectedTag."
    exit 1
}

Write-Host "Release metadata check passed for $expectedTag."
