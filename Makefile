# Article Chat System Makefile

.PHONY: help build run test clean docker-up docker-down dev

help: ## Show this help message
	@echo "Available commands:"
	@echo "  build       - Build the Go server"
	@echo "  run         - Run the Go server locally" 
	@echo "  test        - Run tests"
	@echo "  clean       - Clean build artifacts"
	@echo "  docker-up   - Start all services with Docker Compose"
	@echo "  docker-down - Stop all services"
	@echo "  dev         - Start development environment"

build: ## Build the Go server
	cd server && go build -o ../bin/server ./cmd/api

run: ## Run the Go server locally
	cd server && go run ./cmd/api/main.go

test: ## Run tests
	cd server && go test ./...

clean: ## Clean build artifacts
	rm -rf bin/
	cd server && go clean

docker-up: ## Start all services with Docker Compose
	docker-compose up --build

docker-down: ## Stop all services
	docker-compose down

dev: ## Start development environment
	@echo "Starting development environment..."
	@echo "Make sure you have copied .env.example to .env with your API keys"
	docker-compose up --build -d postgres qdrant redis
	@echo "Databases started. Run 'make run' in another terminal for the server"
	cd client && npm run dev

# Windows-specific commands
build-windows: ## Build for Windows
	cd server && set GOOS=windows&& set GOARCH=amd64&& go build -o ../bin/server.exe ./cmd/api

setup-windows: ## Setup development environment on Windows
	@echo "Setting up Article Chat System on Windows..."
	@echo "1. Make sure Docker Desktop is running"
	@echo "2. Copy .env.example to .env"
	@echo "3. Add your ANTHROPIC_API_KEY to .env"
	@echo "4. Run 'make docker-up' to start services"