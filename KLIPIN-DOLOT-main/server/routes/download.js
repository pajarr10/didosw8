const express = require("express");
const router = express.Router();
const { handleDownload } = require("../controllers/downloadController");
const { handleProxyDownload } = require("../controllers/proxyController");
const { downloadLimiter } = require("../middlewares/rateLimiter");
const { dailyIpLimiter } = require("../middlewares/dailyLimiter");

const DAILY_DOWNLOAD_LIMIT = 300;

// GET /api/download?url=  -> maksimal 50 request per IP per hari
router.get("/download", downloadLimiter, dailyIpLimiter(DAILY_DOWNLOAD_LIMIT), handleDownload);

// GET /api/proxy?url=&filename=&type=  -> stream file, force auto-download
router.get("/proxy", downloadLimiter, handleProxyDownload);

module.exports = router;
