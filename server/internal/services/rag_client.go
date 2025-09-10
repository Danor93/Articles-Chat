package services

import (
	"article-chat-system/server/internal/config"
	"article-chat-system/server/internal/models"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

// RAGClient handles communication with the Node.js RAG service
type RAGClient struct {
	client *resty.Client
	config config.RAGServiceConfig
}

// RAGChatRequest represents the request to the RAG service
type RAGChatRequest struct {
	Query               string               `json:"query"`
	ConversationID      string               `json:"conversationId"`
	ConversationHistory []models.ChatMessage `json:"conversationHistory,omitempty"`
	Stream              bool                 `json:"stream"`
}

// RAGChatResponse represents the response from the RAG service
type RAGChatResponse struct {
	Response       string               `json:"response"`
	Sources        []models.ChunkSource `json:"sources"`
	TokensUsed     int                  `json:"tokensUsed"`
	ProcessingTime int64                `json:"processingTime"`
	ConversationID string               `json:"conversationId"`
}

// RAGArticleRequest represents the request to process an article
type RAGArticleRequest struct {
	URL      string                 `json:"url"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// RAGStatusResponse represents the service status
type RAGStatusResponse struct {
	Status            string                 `json:"status"`
	ProcessedArticles int                    `json:"processedArticles"`
	VectorStoreInfo   map[string]interface{} `json:"vectorStoreInfo"`
}

// NewRAGClient creates a new RAG service client
func NewRAGClient(cfg config.RAGServiceConfig) *RAGClient {
	client := resty.New()
	client.SetTimeout(120 * time.Second)
	client.SetRetryCount(3)
	client.SetRetryWaitTime(1 * time.Second)
	client.SetRetryMaxWaitTime(10 * time.Second)

	// Set headers
	client.SetHeader("Content-Type", "application/json")
	client.SetHeader("Accept", "application/json")

	// Set base URL
	baseURL := cfg.URL
	if baseURL == "" {
		baseURL = "http://rag-service:3001"
	}
	client.SetBaseURL(baseURL)

	// Retry conditions
	client.AddRetryCondition(func(r *resty.Response, err error) bool {
		if err != nil {
			return true
		}
		// Retry on server errors
		return r.StatusCode() >= 500
	})

	return &RAGClient{
		client: client,
		config: cfg,
	}
}

// ProcessChat sends a chat query to the RAG service
func (r *RAGClient) ProcessChat(ctx context.Context, query string, conversationID string, history []models.ChatMessage) (*models.ChatResponse, error) {
	startTime := time.Now()

	request := RAGChatRequest{
		Query:               query,
		ConversationID:      conversationID,
		ConversationHistory: history,
		Stream:              false,
	}

	resp, err := r.client.R().
		SetContext(ctx).
		SetBody(request).
		SetResult(&RAGChatResponse{}).
		Post("/api/chat")

	if err != nil {
		slog.Error("RAG service request failed", "error", err)
		return nil, fmt.Errorf("rag service request failed: %w", err)
	}

	if resp.StatusCode() != http.StatusOK {
		slog.Error("RAG service returned error", "status", resp.StatusCode(), "body", string(resp.Body()))
		return nil, fmt.Errorf("rag service error: status %d, body: %s", resp.StatusCode(), string(resp.Body()))
	}

	ragResp := resp.Result().(*RAGChatResponse)
	processingTime := time.Since(startTime).Milliseconds()

	response := &models.ChatResponse{
		ConversationID: conversationID,
		Message:        ragResp.Response,
		Sources:        ragResp.Sources,
		TokensUsed:     ragResp.TokensUsed,
		ProcessingTime: processingTime,
		Model:          "claude-3-opus",
		CreatedAt:      time.Now(),
	}

	slog.Info("RAG service response received",
		"conversation_id", conversationID,
		"tokens_used", ragResp.TokensUsed,
		"processing_time_ms", processingTime,
		"sources_count", len(ragResp.Sources))

	return response, nil
}

// ProcessChatStream sends a streaming chat query to the RAG service
func (r *RAGClient) ProcessChatStream(ctx context.Context, query string, conversationID string, history []models.ChatMessage) (<-chan models.StreamResponse, error) {
	request := RAGChatRequest{
		Query:               query,
		ConversationID:      conversationID,
		ConversationHistory: history,
		Stream:              true,
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request for streaming
	req, err := http.NewRequestWithContext(ctx, "POST", r.config.URL+"/api/chat/stream", bytes.NewReader(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	httpClient := &http.Client{Timeout: 120 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("rag service error: status %d, body: %s", resp.StatusCode, string(body))
	}

	// Create channel for streaming responses
	responseChan := make(chan models.StreamResponse, 10)

	go func() {
		defer resp.Body.Close()
		defer close(responseChan)

		reader := bufio.NewReader(resp.Body)
		for {
			select {
			case <-ctx.Done():
				responseChan <- models.StreamResponse{
					Type:  "error",
					Error: "context cancelled",
					Done:  true,
				}
				return
			default:
				line, err := reader.ReadString('\n')
				if err != nil {
					if err == io.EOF {
						responseChan <- models.StreamResponse{
							Type: "done",
							Done: true,
						}
						return
					}
					responseChan <- models.StreamResponse{
						Type:  "error",
						Error: err.Error(),
						Done:  true,
					}
					return
				}

				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}

				// Parse SSE data
				if strings.HasPrefix(line, "data: ") {
					data := strings.TrimPrefix(line, "data: ")
					if data == "[DONE]" {
						responseChan <- models.StreamResponse{
							Type: "done",
							Done: true,
						}
						return
					}

					var streamData map[string]interface{}
					if err := json.Unmarshal([]byte(data), &streamData); err != nil {
						slog.Error("Failed to parse stream data", "error", err, "data", data)
						continue
					}

					// Handle different types of stream data
					if msgType, ok := streamData["type"].(string); ok {
						switch msgType {
						case "content":
							if content, ok := streamData["content"].(string); ok {
								responseChan <- models.StreamResponse{
									Type:    "content",
									Content: content,
									Done:    false,
								}
							}
						case "sources":
							if sources, ok := streamData["data"].([]interface{}); ok {
								// Convert sources to proper type
								var chunkSources []models.ChunkSource
								sourcesJSON, _ := json.Marshal(sources)
								json.Unmarshal(sourcesJSON, &chunkSources)
								responseChan <- models.StreamResponse{
									Type: "sources",
									Data: chunkSources,
									Done: false,
								}
							}
						case "error":
							if errMsg, ok := streamData["error"].(string); ok {
								responseChan <- models.StreamResponse{
									Type:  "error",
									Error: errMsg,
									Done:  true,
								}
								return
							}
						}
					}
				}
			}
		}
	}()

	return responseChan, nil
}

// ProcessArticle sends an article to the RAG service for processing
func (r *RAGClient) ProcessArticle(ctx context.Context, url string, metadata map[string]interface{}) error {
	request := RAGArticleRequest{
		URL:      url,
		Metadata: metadata,
	}

	resp, err := r.client.R().
		SetContext(ctx).
		SetBody(request).
		Post("/api/articles/process")

	if err != nil {
		return fmt.Errorf("failed to process article: %w", err)
	}

	if resp.StatusCode() != http.StatusOK && resp.StatusCode() != http.StatusAccepted {
		return fmt.Errorf("failed to process article: status %d, body: %s", resp.StatusCode(), string(resp.Body()))
	}

	slog.Info("Article sent to RAG service for processing", "url", url)
	return nil
}

// HealthCheck verifies the RAG service is accessible
func (r *RAGClient) HealthCheck(ctx context.Context) error {
	resp, err := r.client.R().
		SetContext(ctx).
		Get("/health")

	if err != nil {
		return fmt.Errorf("rag service health check failed: %w", err)
	}

	if resp.StatusCode() != http.StatusOK {
		return fmt.Errorf("rag service unhealthy: status %d", resp.StatusCode())
	}

	return nil
}
