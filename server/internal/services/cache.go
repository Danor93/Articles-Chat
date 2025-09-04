package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
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