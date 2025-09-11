#!/usr/bin/env pwsh

[CmdletBinding()]
param(
    [string]$Configuration = "Release",
    [string]$OutputPath = "./nupkg",
    [string]$Version = $null,
    [switch]$Pack,
    [switch]$Push,
    [string]$ApiKey = $null,
    [string]$Source = "https://api.nuget.org/v3/index.json"
)

# Ensure we're in the right directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $scriptDir "ServiceStack.Alive.csproj"

if (-not (Test-Path $projectPath)) {
    Write-Error "Could not find ServiceStack.Alive.csproj at $projectPath"
    exit 1
}

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

# Set version if provided
$versionArgs = @()
if ($Version) {
    $versionArgs += "/p:PackageVersion=$Version"
    $versionArgs += "/p:AssemblyVersion=$Version"
    $versionArgs += "/p:FileVersion=$Version"
    Write-Host "Building with version: $Version" -ForegroundColor Green
}

try {
    # Clean previous builds
    Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
    dotnet clean $projectPath --configuration $Configuration --verbosity minimal
    if ($LASTEXITCODE -ne 0) { throw "Clean failed" }

    # Restore dependencies
    Write-Host "Restoring dependencies..." -ForegroundColor Yellow
    dotnet restore $projectPath --verbosity minimal
    if ($LASTEXITCODE -ne 0) { throw "Restore failed" }

    # Build the project
    Write-Host "Building project..." -ForegroundColor Yellow
    $buildArgs = @(
        "build", $projectPath,
        "--configuration", $Configuration,
        "--no-restore",
        "--verbosity", "minimal"
    ) + $versionArgs

    & dotnet $buildArgs
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    # Pack the project if requested
    if ($Pack -or $Push) {
        Write-Host "Creating NuGet package..." -ForegroundColor Yellow
        $packArgs = @(
            "pack", $projectPath,
            "--configuration", $Configuration,
            "--no-build",
            "--output", $OutputPath,
            "--verbosity", "minimal"
        ) + $versionArgs

        & dotnet $packArgs
        if ($LASTEXITCODE -ne 0) { throw "Pack failed" }

        # Find the created package
        $packagePattern = "ServiceStack.Alive.*.nupkg"
        $packages = Get-ChildItem -Path $OutputPath -Name $packagePattern | Sort-Object Name -Descending
        
        if ($packages.Count -eq 0) {
            throw "No package found after packing"
        }

        $latestPackage = $packages[0]
        $packagePath = Join-Path $OutputPath $latestPackage
        
        Write-Host "Package created: $packagePath" -ForegroundColor Green

        # Push to NuGet if requested
        if ($Push) {
            if (-not $ApiKey) {
                $ApiKey = $env:NUGET_API_KEY
            }

            if (-not $ApiKey) {
                Write-Error "API key is required for pushing. Provide -ApiKey parameter or set NUGET_API_KEY environment variable."
                exit 1
            }

            Write-Host "Pushing package to $Source..." -ForegroundColor Yellow
            dotnet nuget push $packagePath --api-key $ApiKey --source $Source
            if ($LASTEXITCODE -ne 0) { throw "Push failed" }

            Write-Host "Package pushed successfully!" -ForegroundColor Green
        }
    }

    Write-Host "Script completed successfully!" -ForegroundColor Green

} catch {
    Write-Error "Script failed: $_"
    exit 1
}
