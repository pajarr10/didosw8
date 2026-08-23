const rateLimit = require("express-rate-limit");

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 50, // max 20 request / menit / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan. Silakan coba lagi sebentar lagi.",
  },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { downloadLimiter, globalLimiter };
