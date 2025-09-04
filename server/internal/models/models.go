package models

import (
	"time"
)

type Article struct {
	ID          string    `json:"id" db:"id"`
	URL         string    `json:"url" db:"url"`
	Title       string    `json:"title" db:"title"`
	Content     string    `json:"content" db:"content"`
	RawHTML     string    `json:"raw_html" db:"raw_html"`
	Author      string    `json:"author" db:"author"`
	Source      string    `json:"source" db:"source"`
	FetchedAt   time.Time `json:"fetched_at" db:"fetched_at"`
	PublishedAt time.Time `json:"published_at" db:"published_at"`
	ProcessedAt time.Time `json:"processed_at" db:"processed_at"`
	ChunkCount  int       `json:"chunk_count" db:"chunk_count"`
	Status      string    `json:"status" db:"status"`
	Metadata    Metadata  `json:"metadata" db:"metadata"`
}

type Metadata struct {
	Domain      string            `json:"domain"`
	Language    string            `json:"language"`
	WordCount   int               `json:"word_count"`
	ReadingTime int               `json:"reading_time"`
	Tags        []string          `json:"tags"`
	Summary     string            `json:"summary"`
	Custom      map[string]string `json:"custom"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
	Metadata  ChatMeta  `json:"metadata"`
}

type ChatMeta struct {
	TokenCount   int      `json:"token_count"`
	Sources      []string `json:"sources"`
	ProcessingMs int64    `json:"processing_ms"`
	Model        string   `json:"model"`
}

type ChatRequest struct {
	Message         string            `json:"message"`
	ConversationID  string            `json:"conversation_id,omitempty"`
	Stream          bool              `json:"stream"`
	MaxTokens       int               `json:"max_tokens,omitempty"`
	Temperature     float64           `json:"temperature,omitempty"`
	SearchFilters   map[string]string `json:"search_filters,omitempty"`
	IncludeSources  bool              `json:"include_sources"`
}

type ChatResponse struct {
	ID             string        `json:"id"`
	Message        string        `json:"message"`
	ConversationID string        `json:"conversation_id"`
	Sources        []ChunkSource `json:"sources,omitempty"`
	TokensUsed     int           `json:"tokens_used"`
	ProcessingTime int64         `json:"processing_time_ms"`
	Model          string        `json:"model"`
	CreatedAt      time.Time     `json:"created_at"`
}

type ChunkSource struct {
	ArticleID   string  `json:"article_id"`
	ArticleTitle string  `json:"article_title"`
	ChunkID     string  `json:"chunk_id"`
	Content     string  `json:"content"`
	Relevance   float32 `json:"relevance"`
	Position    int     `json:"position"`
}

type StreamResponse struct {
	Type    string      `json:"type"`
	Content string      `json:"content,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Done    bool        `json:"done"`
	Error   string      `json:"error,omitempty"`
}

type AddArticleRequest struct {
	URL      string            `json:"url"`
	Priority int               `json:"priority"`
	Tags     []string          `json:"tags,omitempty"`
	Custom   map[string]string `json:"custom,omitempty"`
}

type AddArticleResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error     string    `json:"error"`
	Message   string    `json:"message"`
	Code      int       `json:"code"`
	Timestamp time.Time `json:"timestamp"`
	RequestID string    `json:"request_id,omitempty"`
}