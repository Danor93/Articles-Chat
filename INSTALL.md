# Installation Guide

This guide will help you get Clarticle up and running on your local machine.

## Prerequisites

- **Docker Desktop** installed and running
- **Git** for cloning the repository
- **Anthropic Claude API key** (get one at [console.anthropic.com](https://console.anthropic.com))

## Step 1: Clone the Repository

```bash
git clone https://github.com/Danor93/Clarticle.git
cd Clarticle
```

## Step 2: Configure Environment Variables

Clarticle uses service-specific environment files. You need to create `.env` files for each service:

### 1. Backend Service (Go API Gateway)
```bash
cp server/.env.example server/.env
```

The default values should work out of the box. No changes needed unless you want custom ports.

### 2. RAG Service (Node.js) - ⚠️ MOST IMPORTANT
```bash
cp rag-service/.env.example rag-service/.env
```

**Edit `rag-service/.env` and add your Anthropic API key:**
```env
# Replace with your actual API key
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

> **Note**: Without the Anthropic API key, the chat functionality will not work!

### 3. Frontend Service (React)
```bash
cp client/.env.example client/.env
```

The default values should work. No changes needed for local development.

## Step 3: Start the Application

```bash
docker-compose up --build
```

This command will:
1. Build all service images
2. Start all containers (backend, rag-service, frontend, redis)
3. Initialize the vector store
4. Make the application available at http://localhost:3000

First startup may take 5-10 minutes as Docker downloads base images and builds services.

## Step 4: Verify Installation

1. **Check Application**: Open http://localhost:3000 in your browser
2. **Check Health**: Visit http://localhost:3000/api/health
   - Should show all services as "healthy"
3. **Test Chat**: Try asking "Hello, how are you?"
4. **Add Article**: Use the "Add Articles" tab to add a URL

## Environment Variables Reference

### RAG Service (rag-service/.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Your Claude API key | ✅ YES |
| `CLAUDE_MODEL` | Claude model to use | No (default: claude-3-7-sonnet-latest) |
| `CHUNK_SIZE` | Text chunk size | No (default: 1000) |
| `MAX_TOKENS` | Max response tokens | No (default: 4000) |
| `TEMPERATURE` | Model temperature | No (default: 0.7) |

### Backend Service (server/.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `RAG_SERVICE_URL` | RAG service URL | No (default: http://localhost:3001) |
| `REDIS_URL` | Redis cache URL | No (default: redis://localhost:6379) |
| `PORT` | Server port | No (default: 8080) |

### Frontend Service (client/.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | No (default: http://localhost:8080) |

## Common Issues & Solutions

### "Claude API error" or Chat not working
- **Cause**: Missing or invalid Anthropic API key
- **Solution**: Check `rag-service/.env` has valid `ANTHROPIC_API_KEY`

### "Cannot connect to RAG service"
- **Cause**: RAG service failed to start
- **Solution**: Check logs with `docker-compose logs rag-service-nodejs`

### Port already in use
- **Cause**: Another service using ports 3000, 8080, or 3001
- **Solution**: Stop conflicting services or change ports in `.env` files

### Build failures
- **Cause**: Docker daemon not running
- **Solution**: Ensure Docker Desktop is running

## Troubleshooting

### Changes not taking effect after rebuild

If your code changes aren't reflected after rebuilding containers, try building without cache:

```bash
# Rebuild specific service without cache
docker-compose build --no-cache rag-service-nodejs

# Or rebuild all services without cache
docker-compose build --no-cache

# Then restart
docker-compose up
```

### Complete cache clearing

For stubborn cache issues:

```bash
# Stop services and remove containers
docker-compose down

# Prune Docker system
docker system prune -a

# Rebuild and start
docker-compose up --build
```

## Useful Commands

```bash
# View logs for all services
docker-compose logs -f

# View specific service logs
docker-compose logs -f rag-service-nodejs

# Stop all services
docker-compose down

# Rebuild specific service without cache
docker-compose build --no-cache rag-service-nodejs

# Remove all containers and volumes (clean slate)
docker-compose down -v
```

## Next Steps

1. **Add Articles**: Use the "Add Articles" tab to add URLs to your knowledge base
2. **Start Chatting**: Ask questions about the articles you've added
3. **Explore Features**: Try the theme toggle, check response caching, test concurrent requests

Now you're ready to use Clarticle! Open http://localhost:3000 and start chatting with your articles.