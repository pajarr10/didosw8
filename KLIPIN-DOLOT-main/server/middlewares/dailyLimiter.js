const redis = require("../config/redis");
const { logger } = require("../utils/logger");

const SECONDS_UNTIL_MIDNIGHT_BUFFER = 26 * 60 * 60; // 26 jam, buffer aman lintas timezone

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Middleware: batasi jumlah request per IP per hari.
 * Counter disimpan di Redis (bukan memori server) supaya akurat walau
 * di-deploy sebagai serverless function (Vercel) yang instance-nya
 * berganti-ganti tiap request.
 *
 * Pemakaian: dailyIpLimiter(30) -> maksimal 30 request/hari/IP.
 */
function dailyIpLimiter(maxPerDay = 300) {
  return async function (req, res, next) {
    const ip = req.meta?.ip || req.ip || "unknown";
    const key = `limit:daily:${ip}:${todayKey()}`;

    try {
      const count = await redis.incr(key);

      // Set TTL hanya sekali, saat counter baru pertama kali dibuat hari ini.
      if (count === 1) {
        await redis.expire(key, SECONDS_UNTIL_MIDNIGHT_BUFFER);
      }

      if (count > maxPerDay) {
        return res.status(429).json({
          success: false,
          message: `udh ${maxPerDay} jir, kebanyakan cokk .`,
          limit: maxPerDay,
          used: count,
        });
      }

      res.setHeader("X-RateLimit-Limit-Daily", maxPerDay);
      res.setHeader("X-RateLimit-Remaining-Daily", Math.max(0, maxPerDay - count));

      next();
    } catch (err) {
      // Kalau Redis lagi bermasalah, jangan blokir user — lolos saja,
      // supaya layanan tetap jalan (fail-open), cuma dicatat di log.
      logger.error("Gagal cek limit harian IP", { error: err.message, ip });
      next();
    }
  };
}

module.exports = { dailyIpLimiter };
