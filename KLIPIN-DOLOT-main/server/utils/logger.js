const redis = require("../config/redis");

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info(msg, meta = {}) {
    console.log(`[INFO] ${timestamp()} - ${msg}`, Object.keys(meta).length ? meta : "");
  },
  warn(msg, meta = {}) {
    console.warn(`[WARN] ${timestamp()} - ${msg}`, Object.keys(meta).length ? meta : "");
  },
  error(msg, meta = {}) {
    console.error(`[ERROR] ${timestamp()} - ${msg}`, Object.keys(meta).length ? meta : "");
  },
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Simpan satu entri statistik request ke Redis:
 * total, harian, platform, negara, browser, os, device, status, log, top url.
 */
async function recordStat({
  ip,
  country,
  userAgent,
  browser,
  os,
  device,
  referer,
  platform,
  url,
  status, // "success" | "error"
  errorMessage,
}) {
  const day = todayKey();
  const entry = {
    ip,
    country: country || "Unknown",
    userAgent,
    browser: browser || "Unknown",
    os: os || "Unknown",
    device: device || "Desktop",
    referer: referer || "Direct",
    platform: platform || "unknown",
    url,
    status,
    errorMessage: errorMessage || null,
    timestamp: timestamp(),
  };

  try {
    await redis.incr("stats:total");
    await redis.incr(`stats:day:${day}`);
    await redis.incr(`stats:platform:${entry.platform}`);
    await redis.incr(`stats:country:${entry.country}`);
    await redis.incr(`stats:browser:${entry.browser}`);
    await redis.incr(`stats:os:${entry.os}`);
    await redis.incr(`stats:device:${entry.device}`);
    await redis.incr(`stats:status:${status}`);
    await redis.incr(`stats:hour:${new Date().getHours()}`);
    await redis.lpush("stats:log", entry);
    await redis.ltrim("stats:log", 0, 499);
    if (url) await redis.incr(`stats:url:${url}`);
  } catch (e) {
    logger.error("Gagal menyimpan statistik ke Redis", { error: e.message });
  }

  return entry;
}

module.exports = { logger, recordStat, todayKey };
