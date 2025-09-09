// Shared in-memory cache module
const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes in milliseconds

module.exports = {
  get: (key) => {
    const now = Date.now()
    if (cache.has(key)) {
      const cached = cache.get(key)
      if (now - cached.timestamp < CACHE_TTL) {
        return cached.data
      }
      // Remove expired entry
      cache.delete(key)
    }
    return null
  },

  set: (key, data) => {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  },
}
