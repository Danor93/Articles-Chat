# Go API Gateway

This service acts as the API gateway for the Article Chat system. It handles HTTP requests from the frontend, manages caching with Redis, and forwards requests to the RAG service.

## What it does

- Routes API requests between frontend and backend services
- Caches responses in Redis for fast repeated queries
- Handles concurrent requests with worker pools
- Provides health check endpoints

## Requirements

- Go 1.22 or higher
- Redis (optional, will use memory cache if not available)

## Setup

1. Copy the environment file:
```bash
cd server
cp .env.example .env
```

2. Install dependencies:
```bash
go mod tidy
go mod download
```

## Running locally

```bash
go run cmd/api/main.go
```

The server will start on http://localhost:8080

**Note**: Make sure the RAG service is running on port 3001 for full functionality.

## Available endpoints

- `GET /api/health` - Health check
- `POST /api/chat` - Send chat messages
- `POST /api/articles` - Add new articles
- `GET /api/articles` - List articles

## Environment variables

- `RAG_SERVICE_URL` - URL of the RAG service (default: http://localhost:3001)
- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)
- `PORT` - Server port (default: 8080)