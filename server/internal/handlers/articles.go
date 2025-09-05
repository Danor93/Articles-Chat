package handlers

import (
	"article-chat-system/server/internal/fetcher"
	"article-chat-system/server/internal/models"
	"article-chat-system/server/internal/services"
	"article-chat-system/server/internal/workers"
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ArticleHandler struct {
	fetcher     *fetcher.ArticleFetcher
	ragClient   *services.RAGClient
	poolManager *workers.PoolManager
	articles    map[string]*models.Article // In-memory storage for demo
	articlesMux sync.RWMutex
}

func NewArticleHandler(
	fetcher *fetcher.ArticleFetcher,
	ragClient *services.RAGClient,
	poolManager *workers.PoolManager,
) *ArticleHandler {
	return &ArticleHandler{
		fetcher:     fetcher,
		ragClient:   ragClient,
		poolManager: poolManager,
		articles:    make(map[string]*models.Article),
	}
}

func (h *ArticleHandler) HandleAddArticle(c *fiber.Ctx) error {
	var req models.AddArticleRequest
	if err := c.BodyParser(&req); err != nil {
		slog.Error("Failed to parse add article request", "error", err)
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:     "invalid_request",
			Message:   "Failed to parse request body",
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	if req.URL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:     "missing_url",
			Message:   "Article URL is required",
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(c.Context(), 2*time.Minute)
	defer cancel()

	// Process article asynchronously
	responseChan := make(chan models.AddArticleResponse, 1)
	errorChan := make(chan error, 1)

	h.poolManager.SubmitArticleTask(func() {
		// Create a simple article record
		slog.Info("Forwarding article to RAG service", "url", req.URL)
		
		// Generate a simple ID from URL
		articleID := fmt.Sprintf("article_%d", time.Now().Unix())
		article := &models.Article{
			ID:        articleID,
			URL:       req.URL,
			Status:    "processing",
			FetchedAt: time.Now(),
			Source:    "user_submitted",
		}

		// Send article to RAG service for processing
		metadata := map[string]interface{}{
			"article_id": articleID,
			"source":     "user_submitted",
			"submitted_at": time.Now(),
		}
		
		if err := h.ragClient.ProcessArticle(ctx, req.URL, metadata); err != nil {
			slog.Error("Failed to send article to RAG service", "error", err, "url", req.URL)
			errorChan <- fmt.Errorf("failed to process article: %w", err)
			return
		}

		// Store article (in production, save to database)
		h.articlesMux.Lock()
		h.articles[article.ID] = article
		h.articlesMux.Unlock()
		article.Status = "indexed"

		responseChan <- models.AddArticleResponse{
			ID:      article.ID,
			Status:  "success",
			Message: "Article processed and indexed successfully",
		}
	})

	// Wait for completion or timeout
	select {
	case response := <-responseChan:
		slog.Info("Article processing completed",
			"url", req.URL,
			"article_id", response.ID)
		return c.JSON(response)

	case err := <-errorChan:
		slog.Error("Article processing failed", "url", req.URL, "error", err)
		return c.Status(fiber.StatusInternalServerError).JSON(models.ErrorResponse{
			Error:     "processing_failed",
			Message:   fmt.Sprintf("Failed to process article: %v", err),
			Code:      fiber.StatusInternalServerError,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})

	case <-ctx.Done():
		return c.Status(fiber.StatusRequestTimeout).JSON(models.ErrorResponse{
			Error:     "timeout",
			Message:   "Article processing timed out",
			Code:      fiber.StatusRequestTimeout,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}
}

func (h *ArticleHandler) HandleListArticles(c *fiber.Ctx) error {
	h.articlesMux.RLock()
	articles := make([]*models.Article, 0, len(h.articles))
	for _, article := range h.articles {
		articles = append(articles, article)
	}
	h.articlesMux.RUnlock()

	slog.Info("Listed articles", "count", len(articles))
	return c.JSON(fiber.Map{
		"articles": articles,
		"total":    len(articles),
	})
}

func (h *ArticleHandler) HandleGetArticle(c *fiber.Ctx) error {
	articleID := c.Params("id")
	if articleID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:     "missing_id",
			Message:   "Article ID is required",
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	h.articlesMux.RLock()
	article, exists := h.articles[articleID]
	h.articlesMux.RUnlock()
	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(models.ErrorResponse{
			Error:     "article_not_found",
			Message:   "Article not found",
			Code:      fiber.StatusNotFound,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	return c.JSON(article)
}

func (h *ArticleHandler) HandleDeleteArticle(c *fiber.Ctx) error {
	articleID := c.Params("id")
	if articleID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(models.ErrorResponse{
			Error:     "missing_id",
			Message:   "Article ID is required",
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	h.articlesMux.RLock()
	article, exists := h.articles[articleID]
	h.articlesMux.RUnlock()
	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(models.ErrorResponse{
			Error:     "article_not_found",
			Message:   "Article not found",
			Code:      fiber.StatusNotFound,
			Timestamp: time.Now(),
			RequestID: c.Get("X-Request-ID"),
		})
	}

	// Remove from memory (in production, delete from database)
	h.articlesMux.Lock()
	delete(h.articles, articleID)
	h.articlesMux.Unlock()
	
	// Note: Deletion from RAG service should be implemented if needed

	slog.Info("Article deleted successfully", "article_id", articleID, "title", article.Title)

	return c.JSON(fiber.Map{
		"message": "Article deleted successfully",
		"id":      articleID,
	})
}