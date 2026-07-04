param(
    [ValidateSet("test", "vet", "govulncheck")]
    [string] $Command = "test"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$rootPath = $root.Path.TrimEnd("\")
$excludedDirs = @(
    ".git",
    "build",
    "frontend\dist",
    "frontend\node_modules",
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

$goDirs = @(
    Get-ChildItem -Path $root -Recurse -File -Filter "*.go" |
        Where-Object {
            $relativePath = $_.FullName.Substring($rootPath.Length + 1)
            -not (Test-IsExcludedPath $relativePath)
        } |
        ForEach-Object { Split-Path -Parent $_.FullName } |
        Sort-Object -Unique
)

$packages = @()
foreach ($dir in $goDirs) {
    $relativeDir = $dir.Substring($rootPath.Length).TrimStart("\", "/")
    $pattern = if ([string]::IsNullOrWhiteSpace($relativeDir)) {
        "."
    } else {
        "./$($relativeDir -replace "\\", "/")"
    }
    $packages += @(go list $pattern)
}

if ($packages.Count -eq 0) {
    Write-Error "No Go packages found."
    exit 1
}

function Resolve-GoTool {
    param([string] $Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $extension = if ($IsWindows -or $env:OS -eq "Windows_NT") { ".exe" } else { "" }
    $candidate = Join-Path (Join-Path (go env GOPATH) "bin") "$Name$extension"
    if (Test-Path -LiteralPath $candidate) {
        return $candidate
    }

    return $Name
}

switch ($Command) {
    "test" {
        & go test @packages
    }
    "vet" {
        & go vet @packages
    }
    "govulncheck" {
        $govulncheck = Resolve-GoTool "govulncheck"
        & $govulncheck @packages
    }
}

exit $LASTEXITCODE
