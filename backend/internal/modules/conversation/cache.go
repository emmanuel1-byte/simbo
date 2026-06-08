package conversation

import (
	"crypto/sha256"
	"fmt"
	"sync"
	"time"
)

// Cache is a generic thread-safe TTL cache.
type Cache[V any] struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry[V]
}

type cacheEntry[V any] struct {
	value   V
	expires time.Time
}

func NewCache[V any]() *Cache[V] {
	return &Cache[V]{entries: make(map[string]cacheEntry[V])}
}

func (c *Cache[V]) Get(key string) (V, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expires) {
		var zero V
		return zero, false
	}
	return e.value, true
}

func (c *Cache[V]) Set(key string, value V, ttl time.Duration) {
	c.mu.Lock()
	c.entries[key] = cacheEntry[V]{value: value, expires: time.Now().Add(ttl)}
	c.mu.Unlock()
}

// ResultCacheKey produces a stable cache key from a connection ID + SQL.
func ResultCacheKey(connectionID, sql string) string {
	h := sha256.Sum256([]byte(connectionID + "\x00" + sql))
	return fmt.Sprintf("%x", h)
}
