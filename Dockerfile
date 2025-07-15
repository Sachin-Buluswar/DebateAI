# Multi-stage build for production-ready Next.js application
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for better caching
COPY package.json package-lock.json* ./

# Install production dependencies
RUN --mount=type=cache,target=/app/.npm \
    npm set cache /app/.npm && \
    npm ci --only=production

# Stage 2: Build dependencies
FROM node:20-alpine AS build-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev)
RUN --mount=type=cache,target=/app/.npm \
    npm set cache /app/.npm && \
    npm ci

# Stage 3: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependencies from build-deps stage
COPY --from=build-deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the application
RUN npm run build

# Stage 4: Runner
FROM node:20-alpine AS runner

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg libc6-compat

# Add non-root user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Copy public assets first (rarely changes)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy package.json for health checks and version info
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/temp && \
    chown -R nextjs:nodejs /app/uploads /app/temp

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Health check with proper timeout and interval
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Start the application
CMD ["node", "server.js"]