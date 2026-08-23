const redis = require("../config/redis");
const { todayKey } = require("../utils/logger");

const PLATFORM_KEYS = [
  "tiktok",
  "youtube",
  "instagram",
  "douyin",
  "pinterest",
  "facebook",
  "capcut",
  "spotify",
  "unknown",
];

async function getOverview(req, res) {
  try {
    const total = Number((await redis.get("stats:total")) || 0);
    const day = Number((await redis.get(`stats:day:${todayKey()}`)) || 0);
    const success = Number((await redis.get("stats:status:success")) || 0);
    const error = Number((await redis.get("stats:status:error")) || 0);

    const platformCounts = {};
    for (const p of PLATFORM_KEYS) {
      platformCounts[p] = Number((await redis.get(`stats:platform:${p}`)) || 0);
    }

    const hourly = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = Number((await redis.get(`stats:hour:${h}`)) || 0);
    }

    const log = await redis.lrange("stats:log", 0, 199);

    const countryCounts = {};
    const browserCounts = {};
    const osCounts = {};
    const deviceCounts = {};
    const urlCounts = {};
    const ipCounts = {};

    for (const entry of log) {
      countryCounts[entry.country] = (countryCounts[entry.country] || 0) + 1;
      browserCounts[entry.browser] = (browserCounts[entry.browser] || 0) + 1;
      osCounts[entry.os] = (osCounts[entry.os] || 0) + 1;
      deviceCounts[entry.device] = (deviceCounts[entry.device] || 0) + 1;
      if (entry.url) urlCounts[entry.url] = (urlCounts[entry.url] || 0) + 1;
      if (entry.ip) ipCounts[entry.ip] = (ipCounts[entry.ip] || 0) + 1;
    }

    const topIps = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    const topUrls = Object.entries(urlCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    const topPlatform =
      Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0] || null;

    res.json({
      success: true,
      redisConfigured: redis.configured,
      lastUpdated: new Date().toISOString(),
      totalLogsAnalyzed: log.length,
      total,
      today: day,
      statusCount: { success, error },
      successRate: success + error > 0 ? Number(((success / (success + error)) * 100).toFixed(1)) : 0,
      topPlatform: topPlatform ? { name: topPlatform[0], count: topPlatform[1] } : null,
      platformCounts,
      hourly,
      countryCounts,
      browserCounts,
      osCounts,
      deviceCounts,
      topUrls,
      topIps,
      logs: log.slice(0, 60),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal mengambil statistik.", error: err.message });
  }
}

async function verifyAdmin(req, res) {
  const { password, publicKey } = req.body || {};
  const validPassword = process.env.ADMIN_PASSWORD || "pajar";
  const validPublicKey = process.env.ADMIN_PUBLIC_KEY || "pajar";

  if (password === validPassword && publicKey === validPublicKey) {
    return res.json({ success: true, token: process.env.ADMIN_KEY || "pajar" });
  }
  return res.status(401).json({ success: false, message: "Password atau key salah." });
}

module.exports = { getOverview, verifyAdmin };
