# Docker Deployment Guide

This guide covers deploying the Alive Observability Platform using Docker.

## 🚀 Quick Start

### Automated Setup

**Linux/macOS:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```

**Windows PowerShell:**
```powershell
.\docker-start.ps1
```

The script will:
1. Check Docker installation
2. Build the Docker image
3. Start the container
4. Display access information

## 📦 Docker Images

### Pre-built Images

The application is automatically built and published to Docker Hub:

- **Latest stable**: `jassra/alive:latest`
- **Tagged releases**: `jassra/alive:v1.0.0`
- **Branch builds**: `jassra/alive:main`

### Supported Platforms

- `linux/amd64` (Intel/AMD 64-bit)
- `linux/arm64` (ARM 64-bit, Apple Silicon, etc.)

## 🛠️ Manual Deployment

### Build from Source

```bash
# Clone the repository
git clone https://github.com/JasSra/alive.git
cd alive

# Build the image
docker build -t jassra/alive:latest .

# Run the container
docker run -d \
  --name alive-container \
  -p 3001:3001 \
  --restart unless-stopped \
  jassra/alive:latest
```

### Use Pre-built Image

```bash
# Pull and run the latest image
docker pull jassra/alive:latest
docker run -d \
  --name alive-container \
  -p 3001:3001 \
  --restart unless-stopped \
  jassra/alive:latest
```

## 🐳 Docker Compose

### Basic Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  alive:
    image: jassra/alive:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f alive

# Stop the service
docker-compose down
```

### Production Setup with Nginx

```bash
# Start with reverse proxy
docker-compose --profile proxy up -d
```

This setup includes:
- Nginx reverse proxy on port 80
- SSL termination capability
- Load balancing ready
- Health checks

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `PORT` | `3001` | Application port |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |

### Port Mapping

- **3001**: Main application (HTTP)
- **80**: Nginx reverse proxy (when using proxy profile)

### Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps --filter "name=alive-container"

# Manual health check
curl http://localhost:3001/api/ingest
```

## 📊 Data Generation

### Built-in Data Generator

```bash
# Generate test data once
docker exec alive-container node scripts/comprehensive-data-generator.js

# Generate continuous data
docker exec alive-container node scripts/comprehensive-data-generator.js --continuous --interval 2000

# Generate with custom settings
docker exec alive-container node scripts/comprehensive-data-generator.js \
  --continuous \
  --port 3001 \
  --interval 1000 \
  --batch-size 15
```

### External Data Sources

The container accepts data from external sources via:

- **OTLP endpoint**: `http://localhost:3001/api/ingest`
- **Syslog endpoint**: `http://localhost:3001/api/ingest/syslog`
- **Browser monitoring**: `http://localhost:3001/api/monitor.js`

## 🔍 Monitoring & Debugging

### Container Logs

```bash
# Follow real-time logs
docker logs -f alive-container

# View recent logs
docker logs --tail 100 alive-container

# Export logs to file
docker logs alive-container > alive.log 2>&1
```

### Container Shell Access

```bash
# Access container shell
docker exec -it alive-container sh

# Run commands inside container
docker exec alive-container ps aux
docker exec alive-container df -h
docker exec alive-container netstat -tuln
```

### Performance Monitoring

```bash
# Container resource usage
docker stats alive-container

# System resource usage
docker exec alive-container top

# Disk usage
docker exec alive-container du -sh /app
```

## 🔄 Maintenance

### Updates

```bash
# Pull latest image
docker pull jassra/alive:latest

# Stop current container
docker stop alive-container
docker rm alive-container

# Start new container
docker run -d \
  --name alive-container \
  -p 3001:3001 \
  --restart unless-stopped \
  jassra/alive:latest
```

### Backup

```bash
# Export container logs
docker logs alive-container > backup/alive-logs-$(date +%Y%m%d).log

# Save container state (if needed)
docker export alive-container > backup/alive-container-$(date +%Y%m%d).tar
```

### Cleanup

```bash
# Remove container
docker stop alive-container
docker rm alive-container

# Remove image
docker rmi jassra/alive:latest

# Clean up unused resources
docker system prune -f
```

## 🏗️ Production Deployment

### Recommended Setup

```yaml
version: '3.8'

services:
  alive:
    image: jassra/alive:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/ingest"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - alive
    restart: unless-stopped
```

### Security Considerations

1. **Run as non-root**: Container uses `nextjs` user
2. **Minimal attack surface**: Alpine Linux base image
3. **No sensitive data**: In-memory storage only
4. **Network isolation**: Use Docker networks for multi-container setups

### Scaling

```yaml
# docker-compose.override.yml for scaling
version: '3.8'

services:
  alive:
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

## 📞 Support

- **GitHub Issues**: [https://github.com/JasSra/alive/issues](https://github.com/JasSra/alive/issues)
- **Docker Hub**: [https://hub.docker.com/r/jassra/alive](https://hub.docker.com/r/jassra/alive)
- **Documentation**: See main README.md
