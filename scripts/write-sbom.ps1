param(
    [string] $OutputPath = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$config = Get-Content -Raw -LiteralPath (Join-Path $root "wails.json") | ConvertFrom-Json
$version = [string] $config.info.productVersion

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $root "build\installer\OmniMailDesktop-Setup-$version.sbom.json"
}

function New-Purl {
    param(
        [string] $Type,
        [string] $Name,
        [string] $Version
    )

    $encodedName = $Name -replace " ", "%20"
    if ([string]::IsNullOrWhiteSpace($Version)) {
        return "pkg:$Type/$encodedName"
    }
    return "pkg:$Type/$encodedName@$Version"
}

$components = @()

$goModules = @(go list -m all)
foreach ($module in $goModules) {
    $parts = $module -split "\s+"
    if ($parts.Count -lt 2) {
        continue
    }

    $components += [ordered]@{
        type    = "library"
        name    = $parts[0]
        version = $parts[1]
        purl    = New-Purl -Type "golang" -Name $parts[0] -Version $parts[1]
    }
}

$packageLockPath = Join-Path $root "frontend\package-lock.json"
if (Test-Path -LiteralPath $packageLockPath) {
    $node = Get-Command "node" -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Warning "node was not found; npm dependencies will be omitted from the SBOM."
    } else {
        $helperPath = Join-Path $PSScriptRoot "list-npm-lock-packages.mjs"
        $npmPackagesJson = & $node.Source $helperPath $packageLockPath
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }

        $npmPackages = @($npmPackagesJson | ConvertFrom-Json)
        foreach ($package in $npmPackages) {
            $name = [string] $package.name
            $versionValue = [string] $package.version
            if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($versionValue)) {
                continue
            }

            $components += [ordered]@{
                type    = "library"
                name    = $name
                version = $versionValue
                purl    = New-Purl -Type "npm" -Name $name -Version $versionValue
            }
        }
    }
}

$sbom = [ordered]@{
    bomFormat   = "CycloneDX"
    specVersion = "1.5"
    version     = 1
    metadata    = [ordered]@{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        component = [ordered]@{
            type    = "application"
            name    = "OmniMail Desktop"
            version = $version
            purl    = New-Purl -Type "github" -Name "mibgb65-cloud/omni-mail-desktop" -Version $version
        }
    }
    components  = @($components | Sort-Object -Property type, name, version -Unique)
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$sbom | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Host "Wrote SBOM to $OutputPath"
