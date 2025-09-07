# Node.js RAG Service Dockerfile - AI/ML Processing Engine
#
# This Dockerfile creates a specialized AI/ML processing environment for the RAG service.
# Uses Debian base instead of Alpine due to AI/ML library compatibility requirements.
#
# SPECIALIZED AI/ML FEATURES:
# - HuggingFace Transformers support for local embeddings (cost-free)
# - FAISS vector storage for semantic search operations  
# - LangChain.js ecosystem for RAG pipeline orchestration
# - Claude API integration for advanced language understanding
#
# ARCHITECTURE DECISIONS:
# - Debian Base: Required for AI/ML libraries (Alpine causes compatibility issues)
# - Multi-stage Build: Separates build tools from runtime for smaller final image
# - Model Caching: Persistent cache directory for downloaded AI models
# - Non-root Execution: Security best practice with dedicated node user
#
# PERFORMANCE OPTIMIZATIONS:
# - Production dependencies only in final image
# - Efficient Docker layer caching with separate package installation
# - Model cache persistence to avoid repeated downloads
# - Health checks ensure service readiness before accepting traffic

# ============================================================================
# BUILD STAGE - TypeScript Compilation & Dependency Installation
# ============================================================================
FROM node:20-bullseye-slim AS builder

# Install build dependencies required for native modules and AI/ML libraries
# Python3: Required for some native Node.js modules and AI libraries
# build-essential: C++ compiler and tools for native module compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package configuration files for optimal Docker layer caching
# Dependencies are cached even if source code changes
COPY rag-service/package*.json ./
COPY rag-service/tsconfig.json ./

# Install all dependencies (including dev dependencies for TypeScript compilation)
RUN npm ci

# Copy TypeScript source code
COPY rag-service/src ./src

# Compile TypeScript to JavaScript
# Fallback to direct tsc if npm script fails
RUN npm run build || npx tsc

# ============================================================================
# PRODUCTION STAGE - Optimized Runtime Environment
# ============================================================================
FROM node:20-bullseye-slim

# Install minimal runtime dependencies for AI/ML operations
# Python3: Required for HuggingFace transformers and native modules
# curl: Required for health checks and potential external API calls
RUN apt-get update && apt-get install -y \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package configuration for production dependency installation
COPY rag-service/package*.json ./

# Install only production dependencies (excludes dev dependencies like TypeScript)
# This significantly reduces image size while maintaining functionality
RUN npm ci --production

# Copy compiled application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

# Create cache directory for AI/ML model storage
# HuggingFace transformers download models here on first use
# Proper ownership ensures non-root user can write to cache
RUN mkdir -p /app/.cache && chown -R node:node /app

# Set production environment variables
# NODE_ENV=production: Node.js production optimizations
# PORT=3001: Service port
# TRANSFORMERS_CACHE: HuggingFace model cache location
ENV NODE_ENV=production
ENV PORT=3001
ENV TRANSFORMERS_CACHE=/app/.cache

# Expose RAG service port
EXPOSE 3001

# Health check configuration for container orchestration
# Ensures service is ready before receiving traffic from Go backend
# - interval: Check every 30 seconds
# - timeout: 10 seconds per check
# - start-period: 60 seconds initial grace period for AI model loading
# - retries: 3 failures before marking unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user for security
# Node.js process runs with limited privileges
USER node

# Start the RAG service
CMD ["node", "dist/index.js"]