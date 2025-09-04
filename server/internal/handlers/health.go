package handlers

import (
	"article-chat-system/server/internal/config"
	"article-chat-system/server/internal/services"
	"article-chat-system/server/internal/workers"
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

type HealthHandler struct {
	config      *config.Config
	ragClient   *services.RAGClient
	poolManager *workers.PoolManager
}

func NewHealthHandler(cfg *config.Config, ragClient *services.RAGClient, poolManager *workers.PoolManager) *HealthHandler {
	return &HealthHandler{
		config:      cfg,
		ragClient:   ragClient,
		poolManager: poolManager,
	}
}

func (h *HealthHandler) HandleHealth(c *fiber.Ctx) error {
	stats := h.poolManager.GetStats()
	
	// Check RAG service health
	ragStatus := "unknown"
	ctx, cancel := context.WithTimeout(c.Context(), 5*time.Second)
	defer cancel()
	if err := h.ragClient.HealthCheck(ctx); err != nil {
		ragStatus = "unhealthy"
	} else {
		ragStatus = "healthy"
	}
	
	return c.JSON(fiber.Map{
		"status":           "ok",
		"message":          "Article Chat API is running",
		"timestamp":        time.Now(),
		"environment":      h.config.Server.Environment,
		"worker_stats":     stats,
		"rag_service":      ragStatus,
		"rag_service_url":  h.config.RAGService.URL,
	})
}