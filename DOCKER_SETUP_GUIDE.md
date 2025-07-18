# Docker Setup Guide for DebateAI

This guide provides comprehensive instructions for containerizing and deploying the DebateAI Next.js application using Docker.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Environment Variables](#environment-variables)
- [Building Images](#building-images)
- [Deployment](#deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose v2.0+ installed
- At least 4GB of available RAM
- Required API keys and credentials

## Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd debatetest2
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

### 3. Build and run with Docker Compose

**For Development:**
```bash
docker-compose up --build
```

**For Production:**
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## Development Setup

### Building the Development Image

```bash
# Build the image
docker build -t debateai:development .

# Or use docker-compose
docker-compose build
```

### Running in Development Mode

```bash
# Start the application
docker-compose up

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop the application
docker-compose down
```

### Development Features

- **Hot Reload**: Source files are mounted as volumes for instant updates
- **Debug Access**: Debug endpoints available at `/api/debug`
- **Port Mapping**: Application runs on `http://localhost:3001`
- **Resource Limits**: Capped at 2 CPU cores and 2GB RAM

## Production Setup

### Building for Production

```bash
# Build production image
docker build -t debateai:production --target runner .

# Tag for registry
docker tag debateai:production your-registry/debateai:latest
```

### Running in Production

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Scale the application
docker-compose -f docker-compose.prod.yml up -d --scale app=3

# Check service health
docker-compose -f docker-compose.prod.yml ps
```

### Production Features

- **Multi-stage Build**: Optimized image size (~150MB)
- **Non-root User**: Runs as `nextjs` user for security
- **Health Checks**: Automatic health monitoring
- **Resource Limits**: Configurable CPU and memory limits
- **Read-only Filesystem**: Enhanced security with tmpfs for writable areas
- **Nginx Reverse Proxy**: Load balancing and SSL termination

## Environment Variables

### Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys
OPENAI_API_KEY=sk-your-openai-key
OPENAI_VECTOR_STORE_ID=vs_your-vector-store-id
ELEVENLABS_API_KEY=your-elevenlabs-key

# Optional
DEBUG_API_KEY=your-debug-key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=https://debateai.com
```

### Environment-specific Configuration

Create separate `.env` files for different environments:
- `.env.development` - Development settings
- `.env.production` - Production settings
- `.env.staging` - Staging settings

## Building Images

### Multi-stage Build Process

The Dockerfile uses a 4-stage build process:

1. **deps**: Install production dependencies
2. **build-deps**: Install all dependencies including devDependencies
3. **builder**: Build the Next.js application
4. **runner**: Final minimal production image

### Build Arguments

```bash
# Build with custom arguments
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -t debateai:custom .
```

### Build Caching

Enable BuildKit for improved caching:

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with cache mount
docker build --progress=plain -t debateai:latest .
```

## Deployment

### Docker Swarm Deployment

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml debateai

# Update service
docker service update --image debateai:latest debateai_app
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: debateai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: debateai
  template:
    metadata:
      labels:
        app: debateai
    spec:
      containers:
      - name: app
        image: debateai:production
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          limits:
            memory: "2Gi"
            cpu: "2"
          requests:
            memory: "512Mi"
            cpu: "500m"
```

### Cloud Platform Deployment

**AWS ECS:**
```bash
# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker tag debateai:production $ECR_URI/debateai:latest
docker push $ECR_URI/debateai:latest
```

**Google Cloud Run:**
```bash
# Push to GCR
gcloud auth configure-docker
docker tag debateai:production gcr.io/$PROJECT_ID/debateai:latest
docker push gcr.io/$PROJECT_ID/debateai:latest

# Deploy
gcloud run deploy debateai --image gcr.io/$PROJECT_ID/debateai:latest
```

## Monitoring & Maintenance

### Health Checks

The application includes built-in health checks:

```bash
# Check health endpoint
curl http://localhost:3001/api/health

# Docker health status
docker inspect --format='{{.State.Health.Status}}' debateai-app
```

### Logging

```bash
# View logs
docker-compose logs -f app

# Export logs
docker-compose logs app > app.log

# Log rotation is configured in docker-compose files
```

### Backup & Restore

```bash
# Backup volumes
docker run --rm -v debateai_uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v debateai_uploads:/data -v $(pwd):/backup alpine tar xzf /backup/uploads-backup.tar.gz -C /data
```

### Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and deploy with zero downtime
docker-compose -f docker-compose.prod.yml build app
docker-compose -f docker-compose.prod.yml up -d --no-deps --scale app=2 app
```

## Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Check what's using the port
lsof -i :3001

# Use a different port
PORT=3002 docker-compose up
```

**2. Build Failures**
```bash
# Clean build cache
docker builder prune -f

# Build with no cache
docker-compose build --no-cache
```

**3. Permission Issues**
```bash
# Fix volume permissions
docker-compose run --rm app chown -R nextjs:nodejs /app/uploads
```

**4. Memory Issues**
```bash
# Increase Docker memory limit
# Docker Desktop: Preferences > Resources > Memory

# Or use swap
docker-compose -f docker-compose.prod.yml up -d --compatibility
```

### Debug Commands

```bash
# Access container shell
docker-compose exec app sh

# Check environment variables
docker-compose exec app env

# Test database connection
docker-compose exec app node -e "console.log('DB connected')"

# Monitor resource usage
docker stats debateai-app
```

### Performance Optimization

1. **Enable BuildKit caching**:
   ```bash
   export DOCKER_BUILDKIT=1
   export COMPOSE_DOCKER_CLI_BUILD=1
   ```

2. **Use multi-platform builds**:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 -t debateai:latest .
   ```

3. **Optimize layer caching**:
   - Copy package files before source code
   - Use specific COPY commands instead of `COPY . .`
   - Leverage cache mounts for package managers

## Security Best Practices

1. **Never commit secrets**: Use environment variables
2. **Run as non-root**: Application runs as `nextjs` user
3. **Use read-only filesystem**: Enabled in production
4. **Limit resources**: CPU and memory limits configured
5. **Regular updates**: Keep base images updated
6. **Scan for vulnerabilities**:
   ```bash
   docker scan debateai:production
   ```

## Additional Resources

- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Production Checklist](./PRODUCTION_READINESS_PLAN.md)

---

For more help, check the [Troubleshooting Guide](./TROUBLESHOOTING.md) or open an issue in the repository.