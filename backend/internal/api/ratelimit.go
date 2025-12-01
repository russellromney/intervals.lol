package api

import (
	"sync"
	"time"
)

// RateLimiter implements token bucket rate limiting
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	tokens    float64
	lastRefill time.Time
	rate      float64    // tokens per second
	capacity  float64
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*bucket),
	}
}

// Allow checks if a request is allowed based on the rate limit for a key
// rate is number of requests per second (e.g., 0.5 = 1 request per 2 seconds)
func (rl *RateLimiter) Allow(key string, limitType string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	var rate, capacity float64
	switch limitType {
	case "login":
		rate = 0.5      // 1 request per 2 seconds
		capacity = 2.0  // Allow burst of 2
	case "sync":
		rate = 10.0     // 10 requests per second
		capacity = 20.0
	default:
		return true
	}

	bucketKey := key + ":" + limitType
	b, exists := rl.buckets[bucketKey]
	if !exists {
		b = &bucket{
			tokens:     capacity,
			lastRefill: time.Now(),
			rate:       rate,
			capacity:   capacity,
		}
		rl.buckets[bucketKey] = b
	}

	// Refill tokens
	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = min(b.capacity, b.tokens+elapsed*b.rate)
	b.lastRefill = now

	// Check if request is allowed
	if b.tokens >= 1.0 {
		b.tokens--
		return true
	}

	return false
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
