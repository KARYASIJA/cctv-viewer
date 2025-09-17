# CCTV NOC Snapshot Docker

This application has been dockerized for easy deployment and portability.

## Quick Start

### Using Docker Compose (Recommended)

1. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your RTSP URL and settings
   ```

2. **Build and Run**
   ```bash
   docker-compose up -d
   ```

3. **Access Application**
   Open http://localhost:3000 in your browser

### Using Docker directly

1. **Build the image**
   ```bash
   docker build -t cctv-noc-snapshot .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     --name cctv-noc-snapshot \
     -p 3000:3000 \
     -e RTSP_URL="rtsp://username:password@camera_ip:port" \
     -e CAPTURE_INTERVAL=5000 \
     cctv-noc-snapshot
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `RTSP_URL` | RTSP stream URL | `rtsp://admin:password@192.168.1.100:554` |
| `CAPTURE_INTERVAL` | Image capture interval (ms) | `5000` |

## Docker Commands

```bash
# Build image
docker build -t cctv-noc-snapshot .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Remove containers and images
docker-compose down --rmi all
```

## Features

- ✅ **FFmpeg included**: No need to install separately
- ✅ **Health checks**: Container monitoring
- ✅ **Non-root user**: Security best practices
- ✅ **Alpine Linux**: Small image size (~150MB)
- ✅ **Environment variables**: Easy configuration
- ✅ **Volume mounting**: Persistent temp storage (optional)

## Troubleshooting

### Check container logs
```bash
docker-compose logs cctv-noc-snapshot
```

### Access container shell
```bash
docker-compose exec cctv-noc-snapshot sh
```

### Test RTSP connection manually
```bash
docker-compose exec cctv-noc-snapshot ffmpeg -i "$RTSP_URL" -t 1 -f null -
```