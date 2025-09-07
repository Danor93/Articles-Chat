# React Frontend Dockerfile - Static Site Generation with Nginx Proxy
#
# This Dockerfile creates an optimized production deployment for the React frontend
# with nginx reverse proxy configuration for API routing and static asset serving.
#
# BUILD ARCHITECTURE:
# - Stage 1 (builder): Node.js environment for React/Vite build process
# - Stage 2 (production): Nginx web server for static hosting and API proxying
# - Final image size: ~20MB (vs ~300MB+ with Node.js runtime)
#
# NGINX FEATURES:
# - Static Asset Serving: Optimized delivery of React build artifacts
# - API Proxy: Routes /api/* requests to Go backend service
# - GZIP Compression: Reduces bandwidth usage for better performance
# - Client-Side Routing: Supports React Router with fallback to index.html
#
# PRODUCTION OPTIMIZATIONS:
# - Vite build optimization with tree shaking and minification
# - Efficient Docker layer caching with separate dependency installation
# - Alpine Linux base for minimal security surface

# ============================================================================
# BUILD STAGE - React/Vite Build Environment
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for optimal Docker layer caching
# Dependencies are cached even if source code changes
COPY client/package*.json ./

# Install dependencies (cached if package.json unchanged)
RUN npm ci

# Copy React source code and configuration
COPY client/ .

# Build React application with Vite
RUN npm run build

# ============================================================================
# PRODUCTION STAGE - Nginx Web Server with API Proxy
# ============================================================================
FROM nginx:alpine

# Copy built React application to nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration for API proxying and client-side routing
COPY nginx.conf /etc/nginx/nginx.conf

# Expose frontend port
EXPOSE 3000

# Start nginx in foreground mode for Docker
# -g "daemon off;" keeps nginx running in foreground for container lifecycle
CMD ["nginx", "-g", "daemon off;"]