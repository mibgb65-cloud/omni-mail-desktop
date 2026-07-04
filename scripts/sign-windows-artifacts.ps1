param(
    [string] $ArtifactPattern = "build\installer\OmniMailDesktop-Setup-*.exe",
    [string] $CertificateBase64 = $env:WINDOWS_SIGNING_CERT_BASE64,
    [string] $CertificatePassword = $env:WINDOWS_SIGNING_CERT_PASSWORD,
    [string] $TimestampUrl = $(if ($env:WINDOWS_SIGNING_TIMESTAMP_URL) { $env:WINDOWS_SIGNING_TIMESTAMP_URL } else { "http://timestamp.digicert.com" })
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CertificateBase64)) {
    Write-Host "WINDOWS_SIGNING_CERT_BASE64 is not set; skipping code signing."
    exit 0
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pattern = Join-Path $root $ArtifactPattern
$artifacts = @(Get-ChildItem -Path $pattern -File)
if ($artifacts.Count -eq 0) {
    Write-Error "No artifacts matched '$ArtifactPattern'."
    exit 1
}

function Resolve-SignTool {
    $command = Get-Command "signtool.exe" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
    if (Test-Path -LiteralPath $kitsRoot) {
        $candidate = Get-ChildItem -Path $kitsRoot -Recurse -Filter "signtool.exe" |
            Sort-Object -Property FullName -Descending |
            Select-Object -First 1
        if ($candidate) {
            return $candidate.FullName
        }
    }

    return ""
}

$signtool = Resolve-SignTool
if ([string]::IsNullOrWhiteSpace($signtool)) {
    Write-Error "signtool.exe was not found, but signing certificate material was provided."
    exit 1
}

$tempDir = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [System.IO.Path]::GetTempPath() }
$certificatePath = Join-Path $tempDir "omnimail-signing.pfx"
[System.IO.File]::WriteAllBytes($certificatePath, [System.Convert]::FromBase64String($CertificateBase64))

try {
    foreach ($artifact in $artifacts) {
        $arguments = @("sign", "/fd", "SHA256", "/tr", $TimestampUrl, "/td", "SHA256", "/f", $certificatePath)
        if (-not [string]::IsNullOrWhiteSpace($CertificatePassword)) {
            $arguments += @("/p", $CertificatePassword)
        }
        $arguments += $artifact.FullName

        & $signtool @arguments
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
        Write-Host "Signed $($artifact.FullName)"
    }
} finally {
    Remove-Item -LiteralPath $certificatePath -Force -ErrorAction SilentlyContinue
}
