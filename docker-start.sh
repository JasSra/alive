#!/bin/bash

# Alive Observability Platform - Docker Quick Start
# This script helps you get the Alive platform running quickly with Docker

set -e

echo "🚀 Alive Observability Platform - Docker Setup"
echo "=============================================="

# Function to check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        echo "   Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo "❌ Docker is not running. Please start Docker first."
        exit 1
    fi

    echo "✅ Docker is installed and running"
}

# Function to build the Docker image
build_image() {
    echo ""
    echo "🔨 Building Docker image..."
    docker build -t jassra/alive:latest .
    echo "✅ Docker image built successfully"
}

# Function to run the container
run_container() {
    echo ""
    echo "🏃 Starting Alive container..."
    
    # Stop and remove existing container if it exists
    docker stop alive-container 2>/dev/null || true
    docker rm alive-container 2>/dev/null || true
    
    # Run the new container
    docker run -d \
        --name alive-container \
        -p 3001:3001 \
        --restart unless-stopped \
        jassra/alive:latest
    
    echo "✅ Container started successfully"
}

# Function to show status and access information
show_status() {
    echo ""
    echo "📊 Container Status:"
    docker ps --filter "name=alive-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "🌐 Access Information:"
    echo "   Dashboard: http://localhost:3001"
    echo "   API Health: http://localhost:3001/api/ingest"
    echo "   Logs: docker logs -f alive-container"
    
    echo ""
    echo "🔧 Useful Commands:"
    echo "   Stop:    docker stop alive-container"
    echo "   Restart: docker restart alive-container"
    echo "   Logs:    docker logs -f alive-container"
    echo "   Shell:   docker exec -it alive-container sh"
}

# Function to generate test data
generate_data() {
    echo ""
    echo "📝 Generating test data..."
    echo "You can generate test data using:"
    echo "   docker exec alive-container node scripts/comprehensive-data-generator.js --continuous"
}

# Main execution
main() {
    local command=${1:-"all"}
    
    case $command in
        "build")
            check_docker
            build_image
            ;;
        "run")
            check_docker
            run_container
            show_status
            ;;
        "status")
            show_status
            ;;
        "data")
            generate_data
            ;;
        "all"|*)
            check_docker
            build_image
            run_container
            show_status
            generate_data
            ;;
    esac
}

# Help function
show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all     (default) Build image, run container, and show status"
    echo "  build   Build the Docker image only"
    echo "  run     Run the container only"
    echo "  status  Show container status and access info"
    echo "  data    Show data generation commands"
    echo "  help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0          # Build and run everything"
    echo "  $0 build    # Just build the image"
    echo "  $0 run      # Just run the container"
}

# Check for help flag
if [[ "$1" == "help" || "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Run main function
main "$@"
