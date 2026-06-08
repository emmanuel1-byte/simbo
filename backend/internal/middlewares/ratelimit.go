package middlewares

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter is a fixed-window per-IP rate limiter with background cleanup.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rlEntry
	limit   int
	window  time.Duration
}

type rlEntry struct {
	count int
	reset time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*rlEntry),
		limit:   limit,
		window:  window,
	}
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	e, ok := rl.entries[ip]
	if !ok || now.After(e.reset) {
		rl.entries[ip] = &rlEntry{count: 1, reset: now.Add(rl.window)}
		return true
	}
	if e.count >= rl.limit {
		return false
	}
	e.count++
	return true
}

// cleanup removes stale entries every 5 minutes to prevent memory growth.
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, e := range rl.entries {
			if now.After(e.reset) {
				delete(rl.entries, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Middleware returns a Gin handler that rejects requests exceeding the limit.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !rl.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "too many requests — please slow down",
			})
			return
		}
		c.Next()
	}
}

// Pre-built limiters for different route groups.
var (
	// AuthLimiter: 10 attempts/minute — covers login, register, OTP.
	AuthLimiter = NewRateLimiter(10, time.Minute)

	// APILimiter: 120 requests/minute — general authenticated endpoints.
	APILimiter = NewRateLimiter(120, time.Minute)

	// QueryLimiter: 30 queries/minute — AI pipeline is expensive.
	QueryLimiter = NewRateLimiter(30, time.Minute)
)
