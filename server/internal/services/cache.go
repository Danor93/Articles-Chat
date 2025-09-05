package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheService interface for caching operations
type CacheService interface {
	Get(ctx context.Context, key string, dest interface{}) error
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	Delete(ctx context.Context, key string) error
	Close() error
}

// MemoryCache is a simple in-memory cache implementation
type MemoryCache struct {
	store map[string]cacheEntry
}

type cacheEntry struct {
	Value      []byte
	Expiration time.Time
}

// NewMemoryCache creates a new in-memory cache
func NewMemoryCache() *MemoryCache {
	return &MemoryCache{
		store: make(map[string]cacheEntry),
	}
}

// Get retrieves a value from cache
func (m *MemoryCache) Get(ctx context.Context, key string, dest interface{}) error {
	entry, exists := m.store[key]
	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}

	if time.Now().After(entry.Expiration) {
		delete(m.store, key)
		return fmt.Errorf("key expired: %s", key)
	}

	return json.Unmarshal(entry.Value, dest)
}

// Set stores a value in cache
func (m *MemoryCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	m.store[key] = cacheEntry{
		Value:      data,
		Expiration: time.Now().Add(expiration),
	}

	return nil
}

// Delete removes a value from cache
func (m *MemoryCache) Delete(ctx context.Context, key string) error {
	delete(m.store, key)
	return nil
}

// Close closes the cache
func (m *MemoryCache) Close() error {
	m.store = make(map[string]cacheEntry)
	return nil
}

// RedisCache is a Redis-based cache implementation
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache creates a new Redis cache
func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{
		client: client,
	}
}

// Get retrieves a value from Redis cache
func (r *RedisCache) Get(ctx context.Context, key string, dest interface{}) error {
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("key not found: %s", key)
		}
		return err
	}

	return json.Unmarshal([]byte(val), dest)
}

// Set stores a value in Redis cache
func (r *RedisCache) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return r.client.Set(ctx, key, data, expiration).Err()
}

// Delete removes a value from Redis cache
func (r *RedisCache) Delete(ctx context.Context, key string) error {
	return r.client.Del(ctx, key).Err()
}

// Close closes the Redis connection
func (r *RedisCache) Close() error {
	return r.client.Close()
}

// GenerateCacheKey generates a cache key from message and context
func GenerateCacheKey(message string, conversationContext string) string {
	normalizedMessage := normalizeMessage(message)
	combined := normalizedMessage + "|" + conversationContext
	hash := sha256.Sum256([]byte(combined))
	return "chat:" + hex.EncodeToString(hash[:])[:16] // Use first 16 chars of hash
}

// normalizeMessage normalizes text for better cache hits
func normalizeMessage(message string) string {
	// Convert to lowercase and trim whitespace
	normalized := strings.ToLower(strings.TrimSpace(message))
	
	// Remove trailing punctuation (conservative approach)
	normalized = strings.TrimRight(normalized, "?!.,;:")
	
	// Normalize multiple spaces to single spaces
	normalized = strings.Join(strings.Fields(normalized), " ")
	
	return normalized
}

// GenerateArticleCacheKey generates a cache key for article URLs
func GenerateArticleCacheKey(url string) string {
	hash := sha256.Sum256([]byte(url))
	return "article:" + hex.EncodeToString(hash[:])[:16] // Use first 16 chars of hash
}