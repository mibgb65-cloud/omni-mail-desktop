param(
    [string] $InstallerPattern = "build\installer\OmniMailDesktop-Setup-*.exe"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pattern = Join-Path $root $InstallerPattern
$installers = @(Get-ChildItem -Path $pattern -File)
if ($installers.Count -eq 0) {
    Write-Error "No installer matched '$InstallerPattern'."
    exit 1
}

foreach ($installer in $installers) {
    $hash = Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256
    $line = "{0}  {1}" -f $hash.Hash.ToLowerInvariant(), $installer.Name
    $outputPath = "$($installer.FullName).sha256"
    Set-Content -LiteralPath $outputPath -Value $line -Encoding ascii
    Write-Host "Wrote $outputPath"
}
