# Alive Observability Platform - Docker Quick Start (PowerShell)
# This script helps you get the Alive platform running quickly with Docker on Windows

param(
    [Parameter(Position=0)]
    [ValidateSet("all", "build", "run", "status", "data", "help")]
    [string]$Command = "all"
)

function Write-Header {
    Write-Host "🚀 Alive Observability Platform - Docker Setup" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
}

function Test-Docker {
    Write-Host "Checking Docker installation..." -ForegroundColor Yellow
    
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
        Write-Host "   Visit: https://docs.docker.com/get-docker/" -ForegroundColor Yellow
        exit 1
    }

    try {
        docker info | Out-Null
        Write-Host "✅ Docker is installed and running" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Docker is not running. Please start Docker first." -ForegroundColor Red
        exit 1
    }
}

function Build-Image {
    Write-Host ""
    Write-Host "🔨 Building Docker image..." -ForegroundColor Yellow
    docker build -t jassra/alive:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker image built successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to build Docker image" -ForegroundColor Red
        exit 1
    }
}

function Start-Container {
    Write-Host ""
    Write-Host "🏃 Starting Alive container..." -ForegroundColor Yellow
    
    # Stop and remove existing container if it exists
    docker stop alive-container 2>$null | Out-Null
    docker rm alive-container 2>$null | Out-Null
    
    # Run the new container
    docker run -d `
        --name alive-container `
        -p 3001:3001 `
        --restart unless-stopped `
        jassra/alive:latest
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Container started successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to start container" -ForegroundColor Red
        exit 1
    }
}

function Show-Status {
    Write-Host ""
    Write-Host "📊 Container Status:" -ForegroundColor Cyan
    docker ps --filter "name=alive-container" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
    
    Write-Host ""
    Write-Host "🌐 Access Information:" -ForegroundColor Cyan
    Write-Host "   Dashboard: http://localhost:3001" -ForegroundColor White
    Write-Host "   API Health: http://localhost:3001/api/ingest" -ForegroundColor White
    Write-Host "   Logs: docker logs -f alive-container" -ForegroundColor White
    
    Write-Host ""
    Write-Host "🔧 Useful Commands:" -ForegroundColor Cyan
    Write-Host "   Stop:    docker stop alive-container" -ForegroundColor White
    Write-Host "   Restart: docker restart alive-container" -ForegroundColor White
    Write-Host "   Logs:    docker logs -f alive-container" -ForegroundColor White
    Write-Host "   Shell:   docker exec -it alive-container sh" -ForegroundColor White
}

function Show-DataGeneration {
    Write-Host ""
    Write-Host "📝 Generating test data..." -ForegroundColor Cyan
    Write-Host "You can generate test data using:" -ForegroundColor White
    Write-Host "   docker exec alive-container node scripts/comprehensive-data-generator.js --continuous" -ForegroundColor Yellow
}

function Show-Help {
    Write-Host "Usage: .\docker-start.ps1 [command]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Cyan
    Write-Host "  all     (default) Build image, run container, and show status" -ForegroundColor White
    Write-Host "  build   Build the Docker image only" -ForegroundColor White
    Write-Host "  run     Run the container only" -ForegroundColor White
    Write-Host "  status  Show container status and access info" -ForegroundColor White
    Write-Host "  data    Show data generation commands" -ForegroundColor White
    Write-Host "  help    Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\docker-start.ps1          # Build and run everything" -ForegroundColor White
    Write-Host "  .\docker-start.ps1 build    # Just build the image" -ForegroundColor White
    Write-Host "  .\docker-start.ps1 run      # Just run the container" -ForegroundColor White
}

# Main execution
Write-Header

switch ($Command) {
    "build" {
        Test-Docker
        Build-Image
    }
    "run" {
        Test-Docker
        Start-Container
        Show-Status
    }
    "status" {
        Show-Status
    }
    "data" {
        Show-DataGeneration
    }
    "help" {
        Show-Help
    }
    default {
        Test-Docker
        Build-Image
        Start-Container
        Show-Status
        Show-DataGeneration
    }
}
