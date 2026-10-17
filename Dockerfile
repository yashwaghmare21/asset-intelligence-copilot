# Production Dockerfile for Asset Intelligence Copilot
FROM node:20-alpine AS base

# Install security updates
RUN apk --no-cache upgrade

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Set non-root user for container security
USER node

# Expose standard production port
EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production

# Healthcheck for container orchestrators (ECS / Kubernetes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/users || exit 1

CMD ["node", "server.js"]
