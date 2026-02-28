import config from "../config/index.js"

// Simple in-memory cache with TTL expiration
class MemoryCache {
  constructor(ttlSeconds = config.cacheTtl) {
    this.store = new Map()
    this.ttl = ttlSeconds * 1000

    // Periodically clean expired entries to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  get(key) {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key, value, ttlMs) {
    this.store.set(key, {
      value,
      expiry: Date.now() + (ttlMs || this.ttl),
    })
  }

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiry) this.store.delete(key)
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

const cache = new MemoryCache()
export default cache
