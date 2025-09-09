// Article-Chat Go Backend - API Gateway Service
//
// This service acts as the main entry point and orchestrator for the Article-Chat system.
// It implements a hybrid architecture where Go handles HTTP requests, routing, caching,
// and service orchestration, while delegating AI/RAG operations to a specialized Node.js service.
//
// ARCHITECTURE ROLE:
// - API Gateway: Routes all HTTP requests from the React frontend
// - Service Orchestrator: Coordinates between frontend, RAG service, and databases
// - Caching Layer: Implements Redis-based caching with memory fallback for performance
// - Request Handler: Processes HTTP requests with proper validation and error handling
// - Worker Pool Manager: Manages concurrent operations using goroutine pools
//
// KEY DESIGN DECISIONS:
// 1. Hybrid Architecture: Go for concurrency/HTTP, Node.js for AI/RAG operations
// 2. Service Communication: HTTP-based communication with the Node.js RAG service
// 3. Caching Strategy: Redis primary, memory cache fallback for resilience
// 4. Error Handling: Comprehensive error system with standardized codes across services
// 5. Graceful Operations: Proper startup health checks and graceful shutdown handling
//
// SERVICE DEPENDENCIES:
// - Node.js RAG Service (port 3001): Handles LangChain.js, Claude integration, vector operations
// - Redis: Primary caching layer for chat responses and article processing
// - PostgreSQL: User authentication, session management, and chat history persistence
// - React Frontend: Served through nginx proxy, communicates via HTTP API
//
// STARTUP SEQUENCE:
// 1. Load configuration from environment variables
// 2. Initialize structured logging with appropriate levels
// 3. Create worker pools for concurrent operations
// 4. Establish Redis connection with fallback to memory cache
// 5. Connect to PostgreSQL database for authentication
// 6. Initialize RAG client for Node.js service communication
// 7. Health check RAG service availability
// 8. Setup HTTP handlers with dependency injection
// 9. Configure Fiber web server with middleware
// 10. Register API routes and start server
// 11. Setup graceful shutdown handling
package main

import (
	"article-chat-system/server/internal/auth"
	"article-chat-system/server/internal/config"
	"article-chat-system/server/internal/database"
	"article-chat-system/server/internal/fetcher"
	"article-chat-system/server/internal/handlers"
	"article-chat-system/server/internal/middleware"
	"article-chat-system/server/internal/services"
	"article-chat-system/server/internal/workers"
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/redis/go-redis/v9"
)

func main() {
	// PHASE 1: CONFIGURATION AND LOGGING SETUP
	// Load configuration from environment variables (.env files)
	// This includes server settings, RAG service URL, Redis connection details
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Setup structured logging with environment-appropriate levels
	// Development: Debug level for detailed troubleshooting
	// Production: Info level for operational monitoring
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}
	if cfg.Server.Environment == "development" {
		opts.Level = slog.LevelDebug
	}
	
	handler := slog.NewTextHandler(os.Stdout, opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	// PHASE 2: WORKER POOL INITIALIZATION
	// Create managed goroutine pools for concurrent operations
	// ArticleWorkers: Handle article fetching and processing (5 concurrent)
	// Workers: General purpose worker pool for other operations (10 concurrent)
	poolConfig := workers.PoolConfig{
		ArticleWorkers: 5, // Optimized for article fetching without overwhelming external services
		Workers:        10, // General purpose pool for misc operations
	}
	poolManager := workers.NewPoolManager(poolConfig)

	// PHASE 3: REDIS CACHING SETUP WITH FALLBACK STRATEGY
	// Redis provides high-performance caching for chat responses and article processing results
	// Fallback to memory cache ensures service availability if Redis is down
	var redisAddr string
	if len(cfg.Redis.URL) > 8 && cfg.Redis.URL[:8] == "redis://" {
		redisAddr = cfg.Redis.URL[8:] // Remove "redis://" prefix for go-redis client
	} else {
		redisAddr = cfg.Redis.URL
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// Test Redis connection with timeout to avoid blocking startup
	// If Redis is unavailable, gracefully fall back to in-memory caching
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	var cache services.CacheService
	if err := redisClient.Ping(pingCtx).Err(); err != nil {
		slog.Warn("Redis connection failed, falling back to memory cache", "error", err)
		redisClient.Close()
		cache = services.NewMemoryCache() // In-memory fallback maintains basic caching functionality
	} else {
		slog.Info("Redis connection established successfully", "addr", redisAddr)
		cache = services.NewRedisCache(redisClient) // Full Redis caching with persistence
	}
	pingCancel()

	// PHASE 4: DATABASE CONNECTION SETUP
	// Initialize PostgreSQL connection for user authentication and chat history
	slog.Info("Connecting to PostgreSQL database")
	db, err := database.NewConnection(cfg)
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		log.Fatal("Database connection required for authentication features:", err)
	}
	defer db.Close()
	slog.Info("Database connection established successfully")

	// Run any pending migrations
	if err := db.Migrate(); err != nil {
		slog.Error("Database migration failed", "error", err)
		// Continue anyway - migrations might already be applied
	}

	// PHASE 5: SERVICE INITIALIZATION
	// Initialize authentication service
	authService := auth.NewAuthService(db)
	
	// Initialize HTTP client for communicating with Node.js RAG service
	// This client handles all AI/RAG operations including chat processing and article embedding
	ragClient := services.NewRAGClient(cfg.RAGService)
	
	// Initialize article fetcher for processing URLs (if needed for backup/validation)
	articleFetcher := fetcher.NewArticleFetcher()

	// PHASE 6: RAG SERVICE HEALTH CHECK
	// Verify Node.js RAG service is available before accepting requests
	// Non-blocking: service can start even if RAG service is temporarily down
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := ragClient.HealthCheck(ctx); err != nil {
		slog.Warn("RAG service not available at startup", "error", err)
		// Service continues - health endpoint will show RAG service status
	} else {
		slog.Info("RAG service health check passed")
		// RAG service is ready - full functionality available
	}

	// PHASE 7: HTTP HANDLER INITIALIZATION WITH DEPENDENCY INJECTION
	// Handlers are initialized with their required dependencies for clean architecture
	slog.Info("Initializing handlers")
	authHandler := handlers.NewAuthHandler(authService)                 // Auth: user authentication
	chatHandler := handlers.NewChatHandler(ragClient, cache, db)       // Chat: RAG + caching + persistence
	conversationHandler := handlers.NewConversationHandler(db)         // Conversations: CRUD operations
	articleHandler := handlers.NewArticleHandler(articleFetcher, ragClient, poolManager, cache) // Articles: fetching + RAG + pools + caching
	healthHandler := handlers.NewHealthHandler(cfg, ragClient, poolManager) // Health: system status monitoring
	slog.Info("Handlers initialized", 
		"auth_handler_nil", authHandler == nil,
		"chat_handler_nil", chatHandler == nil,
		"conversation_handler_nil", conversationHandler == nil,
		"article_handler_nil", articleHandler == nil,
		"health_handler_nil", healthHandler == nil)

	// PHASE 8: FIBER WEB SERVER CONFIGURATION
	// Configure Fiber with appropriate timeouts and error handling
	app := fiber.New(fiber.Config{
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,  // Prevent slow loris attacks
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second, // Ensure responses don't hang
		ErrorHandler: middleware.ErrorHandler(), // Standardized error responses across all endpoints
	})

	// PHASE 9: MIDDLEWARE STACK SETUP
	// Middleware is applied in order - each request passes through this stack
	app.Use(recover.New())              // Recover from panics gracefully
	app.Use(middleware.RequestID())     // Generate unique request IDs for tracing
	app.Use(cors.New(cors.Config{       // Enable CORS for React frontend communication
		AllowOrigins: "*",              // Allow all origins (configure for production)
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))
	// Note: Request logging middleware temporarily disabled for debugging
	// Can be re-enabled with: app.Use(fiberLogger.New(...))

	// PHASE 10: API ROUTE REGISTRATION
	// Routes are organized by functionality with proper HTTP methods
	
	// System health endpoint - critical for monitoring and load balancers
	app.Get("/api/health", healthHandler.HandleHealth)

	// API route group for versioning and organization
	api := app.Group("/api")
	
	// Development/testing endpoints for API validation
	api.Get("/test", func(c *fiber.Ctx) error {
		slog.Info("Test endpoint called")
		return c.JSON(fiber.Map{
			"message": "API routing is working",
			"timestamp": time.Now(),
		})
	})
	
	// Simple connectivity test
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString("pong")
	})
	
	// Authentication endpoints - user registration, login, profile management
	if authHandler != nil {
		authGroup := api.Group("/auth")
		authGroup.Post("/signup", authHandler.HandleSignup)                                  // User registration
		authGroup.Post("/login", authHandler.HandleLogin)                                   // User login
		authGroup.Post("/logout", auth.RequireAuth(authService), authHandler.HandleLogout)  // Logout current session
		authGroup.Post("/logout-all", auth.RequireAuth(authService), authHandler.HandleLogoutAll) // Logout all sessions
		authGroup.Get("/me", auth.RequireAuth(authService), authHandler.HandleGetProfile)    // Get current user profile
		authGroup.Put("/profile", auth.RequireAuth(authService), authHandler.HandleUpdateProfile) // Update profile
		authGroup.Get("/check-email", authHandler.HandleCheckEmail)                          // Check if email exists
	}
	
	// Chat endpoints - main functionality for RAG-based conversations (requires authentication)
	if chatHandler != nil {
		// Apply required auth middleware to chat endpoint - all chat requires authentication
		api.Post("/chat", auth.RequireAuth(authService), chatHandler.HandleChat) // Process chat messages through RAG service
	}
	
	// Conversation endpoints - chat history management (requires authentication)
	if conversationHandler != nil {
		convGroup := api.Group("/conversations", auth.RequireAuth(authService))
		convGroup.Get("/", conversationHandler.HandleListConversations)             // List user's conversations
		convGroup.Post("/", conversationHandler.HandleCreateConversation)          // Create new conversation
		convGroup.Get("/:id", conversationHandler.HandleGetConversation)           // Get conversation with messages
		convGroup.Put("/:id", conversationHandler.HandleUpdateConversation)        // Update conversation title
		convGroup.Delete("/:id", conversationHandler.HandleDeleteConversation)     // Delete conversation
		convGroup.Get("/:id/messages", conversationHandler.HandleGetConversationMessages) // Get conversation messages with pagination
	}
	
	// Article management endpoints - CRUD operations for knowledge base (requires authentication)
	if articleHandler != nil {
		articleGroup := api.Group("/articles", auth.RequireAuth(authService))
		articleGroup.Post("/", articleHandler.HandleAddArticle)       // Add new article to RAG system
		articleGroup.Get("/", articleHandler.HandleListArticles)       // List processed articles
		articleGroup.Get("/:id", articleHandler.HandleGetArticle)     // Get specific article details
		articleGroup.Delete("/:id", articleHandler.HandleDeleteArticle) // Remove article from system
	}

	// PHASE 11: GRACEFUL SHUTDOWN HANDLING
	// Proper shutdown sequence ensures no data loss and clean resource cleanup
	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM) // Listen for shutdown signals
		<-c // Block until signal received

		slog.Info("Shutting down server...")
		
		// 1. Stop accepting new work - shutdown worker pools first
		poolManager.Shutdown()
		
		// 2. Close cache connections to prevent data corruption
		if err := cache.Close(); err != nil {
			slog.Error("Cache close error", "error", err)
		}
		
		// 3. Close database connections
		if err := db.Close(); err != nil {
			slog.Error("Database close error", "error", err)
		}
		
		// 4. Shutdown HTTP server gracefully - allows in-flight requests to complete
		if err := app.Shutdown(); err != nil {
			slog.Error("Server shutdown error", "error", err)
		}
		
		slog.Info("Server shutdown complete")
		os.Exit(0)
	}()

	// PHASE 12: SERVER STARTUP
	// Start the HTTP server and begin accepting requests
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	slog.Info("Starting Article Chat API server", 
		"address", addr, 
		"environment", cfg.Server.Environment,
		"rag_service_url", cfg.RAGService.URL)
	
	// app.Listen blocks here - server runs until shutdown signal
	if err := app.Listen(addr); err != nil {
		slog.Error("Server failed to start", "error", err)
		poolManager.Shutdown() // Cleanup on startup failure
		log.Fatal(err)
	}
}