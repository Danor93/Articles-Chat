package main

import (
	"article-chat-system/server/internal/config"
	"article-chat-system/server/internal/fetcher"
	"article-chat-system/server/internal/handlers"
	"article-chat-system/server/internal/services"
	"article-chat-system/server/internal/workers"
	"context"
	"errors"
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
	"github.com/gofiber/fiber/v2/middleware/requestid"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Setup structured logging
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}
	if cfg.Server.Environment == "development" {
		opts.Level = slog.LevelDebug
	}
	
	handler := slog.NewTextHandler(os.Stdout, opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)

	// Initialize worker pools
	poolConfig := workers.PoolConfig{
		ArticleWorkers: 5,
		Workers:        10,
	}
	poolManager := workers.NewPoolManager(poolConfig)

	// Initialize services
	ragClient := services.NewRAGClient(cfg.RAGService)
	cache := services.NewMemoryCache()
	articleFetcher := fetcher.NewArticleFetcher()

	// Check RAG service health
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := ragClient.HealthCheck(ctx); err != nil {
		slog.Warn("RAG service not available at startup", "error", err)
	} else {
		slog.Info("RAG service health check passed")
	}

	// Initialize handlers
	slog.Info("Initializing handlers")
	chatHandler := handlers.NewChatHandler(ragClient, cache)
	articleHandler := handlers.NewArticleHandler(articleFetcher, ragClient, poolManager)
	healthHandler := handlers.NewHealthHandler(cfg, ragClient, poolManager)
	slog.Info("Handlers initialized", 
		"chat_handler_nil", chatHandler == nil,
		"article_handler_nil", articleHandler == nil,
		"health_handler_nil", healthHandler == nil)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			// Handle nil errors (shouldn't happen but defensive programming)
			if err == nil {
				return nil
			}
			
			// Status code defaults to 500
			code := fiber.StatusInternalServerError
			message := "Internal server error"
			
			// Retrieve the custom status code if it's a *fiber.Error
			var e *fiber.Error
			if errors.As(err, &e) {
				code = e.Code
				message = e.Message
			}
			
			// Log the error
			slog.Error("Request error", 
				"error", err.Error(), 
				"path", c.Path(), 
				"method", c.Method(),
				"status", code)
			
			// Send error response
			return c.Status(code).JSON(fiber.Map{
				"error": message,
			})
		},
	})

	// Middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))
	// Temporarily disable logger to debug
	// app.Use(fiberLogger.New(fiberLogger.Config{
	// 	Format: "${time} ${status} - ${method} ${path} ${latency}\n",
	// }))

	// Health check endpoint
	app.Get("/api/health", healthHandler.HandleHealth)

	// API Routes
	api := app.Group("/api")
	
	// Test endpoint
	api.Get("/test", func(c *fiber.Ctx) error {
		slog.Info("Test endpoint called")
		return c.JSON(fiber.Map{
			"message": "API routing is working",
			"timestamp": time.Now(),
		})
	})
	
	// Super simple test
	api.Get("/ping", func(c *fiber.Ctx) error {
		return c.SendString("pong")
	})
	
	// Chat endpoints
	if chatHandler != nil {
		api.Post("/chat", chatHandler.HandleChat)
	}
	
	// Article management endpoints
	if articleHandler != nil {
		api.Post("/articles", articleHandler.HandleAddArticle)
		api.Get("/articles", articleHandler.HandleListArticles)
		api.Get("/articles/:id", articleHandler.HandleGetArticle)
		api.Delete("/articles/:id", articleHandler.HandleDeleteArticle)
	}

	// Graceful shutdown
	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		<-c

		slog.Info("Shutting down server...")
		
		// Shutdown worker pools
		poolManager.Shutdown()
		
		// Shutdown Fiber server
		if err := app.Shutdown(); err != nil {
			slog.Error("Server shutdown error", "error", err)
		}
		
		slog.Info("Server shutdown complete")
		os.Exit(0)
	}()

	// Start server
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	slog.Info("Starting Article Chat API server", 
		"address", addr, 
		"environment", cfg.Server.Environment,
		"rag_service_url", cfg.RAGService.URL)
	
	if err := app.Listen(addr); err != nil {
		slog.Error("Server failed to start", "error", err)
		poolManager.Shutdown()
		log.Fatal(err)
	}
}