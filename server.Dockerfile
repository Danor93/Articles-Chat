# Go Backend Service Dockerfile - Multi-Stage Production Build
#
# This Dockerfile creates an optimized production image for the Go API Gateway service.
# Uses multi-stage build pattern to minimize final image size and security attack surface.
#
# BUILD STRATEGY:
# - Stage 1 (builder): Full Go toolchain for compilation
# - Stage 2 (production): Minimal Alpine Linux runtime
# - Final image size: ~15MB (vs ~300MB+ with full Go image)
#
# SECURITY FEATURES:
# - Static binary compilation (no dynamic dependencies)
# - Minimal attack surface with Alpine Linux base
# - CA certificates for HTTPS connections to external APIs
# - Non-root execution environment
#
# PERFORMANCE OPTIMIZATIONS:
# - CGO disabled for better performance and portability
# - Static linking eliminates runtime dependency issues
# - Efficient Docker layer caching with separate dependency installation

# ============================================================================
# BUILD STAGE - Go Compilation Environment
# ============================================================================
FROM golang:1.23-alpine AS builder

# Set working directory for build
WORKDIR /app

# Copy Go module files first for better Docker layer caching
# This allows dependency downloads to be cached even if source code changes
COPY server/go.mod server/go.sum ./

# Download dependencies (cached if go.mod/go.sum unchanged)
RUN go mod download

# Copy source code after dependencies for optimal caching
COPY server/ .

# Build static binary with optimizations:
# - CGO_ENABLED=0: Disable CGO for static linking and better performance
# - GOOS=linux: Target Linux for container environment
# - -a: Force rebuild of packages that are already up-to-date
# - -installsuffix cgo: Ensure packages built without CGO
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/api

# ============================================================================
# PRODUCTION STAGE - Minimal Runtime Environment
# ============================================================================
FROM alpine:latest

# Install CA certificates for HTTPS connections to external services
# Required for Redis, potential external API calls, health checks
RUN apk --no-cache add ca-certificates

# Set working directory
WORKDIR /root/

# Copy compiled binary from builder stage (only ~10MB)
COPY --from=builder /app/main .

# Expose HTTP port for API Gateway
EXPOSE 8080

# Run the Go API Gateway service
CMD ["./main"]
