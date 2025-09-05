# Use Node.js LTS with Debian base for better compatibility
FROM node:20-bullseye-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY rag-service/package*.json ./
COPY rag-service/tsconfig.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY rag-service/src ./src

# Build TypeScript
RUN npm run build || npx tsc

# Production stage
FROM node:20-bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY rag-service/package*.json ./

# Install production dependencies
RUN npm ci --production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

# Create cache directory for transformer models
RUN mkdir -p /app/.cache && chown -R node:node /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV TRANSFORMERS_CACHE=/app/.cache

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

USER node

# Run the compiled JavaScript or TypeScript directly
CMD ["node", "dist/index.js"]