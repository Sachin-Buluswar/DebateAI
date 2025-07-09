# Docker Deployment Guide for DebateAI

This guide explains how to build and deploy DebateAI using Docker.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- All environment variables configured in `.env.local`

## Quick Start

### 1. Build the Docker Image

```bash
# Build for development
./scripts/docker-build.sh

# Build for production
./scripts/docker-build.sh production
```

### 2. Run the Application

```bash
# Run in development mode
./scripts/docker-run.sh

# Run in production mode
./scripts/docker-run.sh production
```

## Manual Docker Commands

### Building the Image

```bash
# Build the image manually
docker build -t debateai:latest .

# Build with build arguments
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=your_url \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -t debateai:latest .
```

### Running with Docker Compose

```bash
# Development
docker-compose up -d

# Production (with nginx)
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### Running Standalone Container

```bash
docker run -d \
  --name debateai \
  -p 3000:3000 \
  --env-file .env.local \
  debateai:latest
```

## Production Deployment

### SSL Certificate Setup

For production deployment with HTTPS:

1. Obtain SSL certificates (e.g., from Let's Encrypt)
2. Place certificates in `./ssl/` directory:
   - `fullchain.pem`
   - `privkey.pem`

### Environment Variables

Create a `.env.production` file with production values:

```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=your_production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
OPENAI_VECTOR_STORE_ID=your_vector_store_id
ELEVENLABS_API_KEY=your_elevenlabs_key
NEXT_PUBLIC_SITE_URL=https://debateai.com
```

### Deployment Steps

1. **Build the production image:**
   ```bash
   ./scripts/docker-build.sh production
   ```

2. **Start the production stack:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Monitor the deployment:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

## Health Checks

The application includes health checks:

- **Application health:** `http://localhost:3000/api/health`
- **Nginx health:** `http://localhost/health`

## Resource Limits

The production configuration includes resource limits:

- **CPU:** 2 cores limit, 0.5 cores reserved
- **Memory:** 2GB limit, 512MB reserved

Adjust these in `docker-compose.prod.yml` based on your server capacity.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs debateai-app

# Check container status
docker ps -a

# Inspect container
docker inspect debateai-app
```

### Build failures

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t debateai:latest .
```

### Performance issues

```bash
# Check resource usage
docker stats

# Increase resource limits in docker-compose.prod.yml
```

## Security Considerations

1. **Never commit `.env` files** to version control
2. **Use secrets management** for production deployments
3. **Regularly update** base images and dependencies
4. **Enable firewall** rules for production servers
5. **Use HTTPS** in production with valid certificates

## Monitoring

For production monitoring, consider:

1. **Log aggregation:** Ship logs to centralized logging service
2. **Metrics collection:** Use Prometheus/Grafana for metrics
3. **Uptime monitoring:** Set up external health check monitoring
4. **Alert configuration:** Configure alerts for failures

## Backup and Recovery

1. **Database backups:** Supabase handles database backups
2. **Environment backups:** Keep secure copies of environment variables
3. **Image backups:** Push production images to private registry

```bash
# Tag and push to registry
docker tag debateai:production your-registry.com/debateai:v1.0.0
docker push your-registry.com/debateai:v1.0.0
```