/**
 * Cache ringan in-memory (TTL) khusus hasil scraping,
 * supaya URL yang sama tidak memicu request berulang ke upstream
 * dalam rentang waktu singkat.
 */
class TTLCache {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttl = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttl });
  }

  // Bersihkan entry kadaluarsa secara berkala
  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

const downloadCache = new TTLCache(5 * 60 * 1000); // 5 menit
setInterval(() => downloadCache.sweep(), 60 * 1000).unref();

module.exports = { downloadCache };
