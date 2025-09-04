package fetcher

import (
	"article-chat-system/server/internal/models"
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/google/uuid"
)

type ArticleFetcher struct {
	client *resty.Client
}

type JinaResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		URL         string `json:"url"`
		Content     string `json:"content"`
		Usage       struct {
			Tokens int `json:"tokens"`
		} `json:"usage"`
	} `json:"data"`
}

func NewArticleFetcher() *ArticleFetcher {
	client := resty.New()
	client.SetTimeout(30 * time.Second)
	client.SetRetryCount(3)
	client.SetRetryWaitTime(1 * time.Second)
	client.SetRetryMaxWaitTime(5 * time.Second)

	// Retry on server errors and timeouts
	client.AddRetryCondition(func(r *resty.Response, err error) bool {
		if err != nil {
			return true
		}
		return r.StatusCode() >= 500
	})

	return &ArticleFetcher{
		client: client,
	}
}

func (f *ArticleFetcher) FetchArticle(ctx context.Context, articleURL string) (*models.Article, error) {
	if err := f.validateURL(articleURL); err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	slog.Info("Fetching article", "url", articleURL)

	// Use Jina Reader API for clean article extraction
	jinaURL := "https://r.jina.ai/" + articleURL
	
	// Get JINA API key from environment
	jinaAPIKey := os.Getenv("JINA_API_KEY")

	request := f.client.R().
		SetContext(ctx).
		SetHeader("Accept", "application/json").
		SetResult(&JinaResponse{})
		
	// Add Authorization header if API key is available
	if jinaAPIKey != "" {
		request = request.SetHeader("Authorization", "Bearer "+jinaAPIKey)
	}

	resp, err := request.Get(jinaURL)

	if err != nil {
		slog.Error("Failed to fetch article", "url", articleURL, "error", err)
		return nil, fmt.Errorf("failed to fetch article: %w", err)
	}

	if resp.StatusCode() != 200 {
		slog.Error("Jina Reader API error", "status", resp.StatusCode(), "url", articleURL)
		return nil, fmt.Errorf("jina reader api error: status %d", resp.StatusCode())
	}

	jinaResp := resp.Result().(*JinaResponse)
	if jinaResp.Code != 200 {
		return nil, fmt.Errorf("jina reader failed: %s", jinaResp.Msg)
	}

	// Create article model
	article := &models.Article{
		ID:          uuid.New().String(),
		URL:         articleURL,
		Title:       jinaResp.Data.Title,
		Content:     jinaResp.Data.Content,
		Source:      f.extractDomain(articleURL),
		FetchedAt:   time.Now(),
		ProcessedAt: time.Now(),
		Status:      "fetched",
		Metadata: models.Metadata{
			Domain:      f.extractDomain(articleURL),
			WordCount:   len(strings.Fields(jinaResp.Data.Content)),
			ReadingTime: f.calculateReadingTime(jinaResp.Data.Content),
		},
	}

	// Calculate reading time (average 200 words per minute)
	article.Metadata.ReadingTime = article.Metadata.WordCount / 200
	if article.Metadata.ReadingTime < 1 {
		article.Metadata.ReadingTime = 1
	}

	slog.Info("Article fetched successfully",
		"url", articleURL,
		"title", article.Title,
		"word_count", article.Metadata.WordCount,
		"reading_time", article.Metadata.ReadingTime)

	return article, nil
}

func (f *ArticleFetcher) FetchMultiple(ctx context.Context, urls []string) ([]*models.Article, []error) {
	if len(urls) == 0 {
		return nil, nil
	}

	articles := make([]*models.Article, len(urls))
	errors := make([]error, len(urls))

	// Create channels for results
	type result struct {
		index   int
		article *models.Article
		err     error
	}

	resultChan := make(chan result, len(urls))

	// Start workers for concurrent fetching
	semaphore := make(chan struct{}, 5) // Limit concurrent requests
	for i, articleURL := range urls {
		go func(index int, url string) {
			semaphore <- struct{}{} // Acquire
			defer func() { <-semaphore }() // Release

			article, err := f.FetchArticle(ctx, url)
			resultChan <- result{
				index:   index,
				article: article,
				err:     err,
			}
		}(i, articleURL)
	}

	// Collect results
	for i := 0; i < len(urls); i++ {
		select {
		case res := <-resultChan:
			articles[res.index] = res.article
			errors[res.index] = res.err
		case <-ctx.Done():
			return nil, []error{ctx.Err()}
		}
	}

	return articles, errors
}

func (f *ArticleFetcher) validateURL(rawURL string) error {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL format: %w", err)
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("URL must use http or https scheme")
	}

	if parsedURL.Host == "" {
		return fmt.Errorf("URL must have a host")
	}

	return nil
}

func (f *ArticleFetcher) extractDomain(rawURL string) string {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "unknown"
	}
	return parsedURL.Host
}

func (f *ArticleFetcher) calculateReadingTime(content string) int {
	wordCount := len(strings.Fields(content))
	readingTime := wordCount / 200 // 200 words per minute average
	if readingTime < 1 {
		readingTime = 1
	}
	return readingTime
}