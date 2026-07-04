param(
    [Parameter(Mandatory = $true)]
    [string] $Repository,
    [Parameter(Mandatory = $true)]
    [string] $Tag,
    [string] $GitHubToken = $env:GITHUB_TOKEN
)

$ErrorActionPreference = "Stop"

if ($Tag -notlike "v*") {
    Write-Error "A v* tag is required."
    exit 1
}

$version = $Tag.TrimStart("v")
$headers = @{
    Accept       = "application/vnd.github+json"
    "User-Agent" = "OmniMailDesktop-release-check"
}
if (-not [string]::IsNullOrWhiteSpace($GitHubToken)) {
    $headers.Authorization = "Bearer $GitHubToken"
}

$releaseUrl = "https://api.github.com/repos/$Repository/releases/tags/$Tag"
$release = Invoke-RestMethod -Headers $headers -Uri $releaseUrl
$requiredAssets = @(
    "OmniMailDesktop-Setup-$version.exe",
    "OmniMailDesktop-Setup-$version.exe.sha256",
    "OmniMailDesktop-Setup-$version.sbom.json",
    "update-manifest.json"
)

foreach ($assetName in $requiredAssets) {
    if (-not ($release.assets | Where-Object { $_.name -eq $assetName })) {
        Write-Error "Release $Tag is missing asset '$assetName'."
        exit 1
    }
}

$installerAsset = $release.assets | Where-Object { $_.name -eq "OmniMailDesktop-Setup-$version.exe" } | Select-Object -First 1
$manifestAsset = $release.assets | Where-Object { $_.name -eq "update-manifest.json" } | Select-Object -First 1
$manifest = Invoke-RestMethod -Headers $headers -Uri $manifestAsset.browser_download_url

if ([string] $manifest.version -ne $version -or [string] $manifest.tag -ne $Tag) {
    Write-Error "Published manifest version/tag does not match $Tag."
    exit 1
}
if ([string] $manifest.installer.name -ne $installerAsset.name) {
    Write-Error "Published manifest installer name '$($manifest.installer.name)' does not match '$($installerAsset.name)'."
    exit 1
}
if ([int64] $manifest.installer.size -ne [int64] $installerAsset.size) {
    Write-Error "Published manifest installer size '$($manifest.installer.size)' does not match '$($installerAsset.size)'."
    exit 1
}
if ([string] $manifest.installer.url -ne [string] $installerAsset.browser_download_url) {
    Write-Error "Published manifest installer URL does not match the release asset URL."
    exit 1
}

$expectedDigest = ([string] $installerAsset.digest).Replace("sha256:", "")
if ($expectedDigest -and [string] $manifest.installer.sha256 -ne $expectedDigest) {
    Write-Error "Published manifest SHA256 '$($manifest.installer.sha256)' does not match asset digest '$expectedDigest'."
    exit 1
}

Write-Host "Published release check passed for $Tag."
