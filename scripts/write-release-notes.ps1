param(
    [string] $Tag = $env:GITHUB_REF_NAME,
    [string] $ChangelogPath = (Join-Path $PSScriptRoot "..\CHANGELOG.md"),
    [string] $OutputPath = "release-notes.md"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Tag) -and $env:GITHUB_REF -match "^refs/tags/(v.+)$") {
    $Tag = $Matches[1]
}
if ($Tag -notlike "v*") {
    Write-Error "A v* tag is required to extract release notes."
    exit 1
}

$lines = @(Get-Content -LiteralPath $ChangelogPath)
$headingPattern = "^##\s+\[$([regex]::Escape($Tag))\]\s+-\s+"
$start = -1
for ($i = 0; $i -lt $lines.Count; $i += 1) {
    if ($lines[$i] -match $headingPattern) {
        $start = $i
        break
    }
}
if ($start -lt 0) {
    Write-Error "CHANGELOG.md does not contain release notes for $Tag."
    exit 1
}

$end = $lines.Count
for ($i = $start + 1; $i -lt $lines.Count; $i += 1) {
    if ($lines[$i] -match "^##\s+\[") {
        $end = $i
        break
    }
}

$notes = $lines[$start..($end - 1)] -join [Environment]::NewLine
Set-Content -LiteralPath $OutputPath -Value $notes -Encoding utf8
Write-Host "Wrote release notes for $Tag to $OutputPath."
