const axios = require("axios");
const { randomUserAgent } = require("../utils/userAgents");
const { logger } = require("../utils/logger");

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

function isValidUrl(str) {
  if (!str || typeof str !== "string") return false;
  if (!URL_REGEX.test(str.trim())) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(str.trim());
    return true;
  } catch {
    return false;
  }
}

function safeFilename(name, fallbackExt) {
  const cleaned = (name || "klipin-media")
    .toString()
    .replace(/[^a-z0-9-_ .]/gi, "")
    .trim()
    .slice(0, 80);
  const base = cleaned || "klipin-media";
  return base.includes(".") ? base : `${base}.${fallbackExt}`;
}

/**
 * GET /api/proxy?url=<media_url>&filename=<name>&type=video|audio|image
 * Men-stream file dari sumber upstream ke client dengan header
 * Content-Disposition: attachment supaya browser langsung mengunduh,
 * bukan membuka tab baru / halaman preview.
 */
async function handleProxyDownload(req, res) {
  const targetUrl = (req.query.url || "").trim();
  const type = (req.query.type || "video").toLowerCase();
  const extMap = { video: "mp4", audio: "mp3", image: "jpg" };
  const filename = safeFilename(req.query.filename, extMap[type] || "bin");

  if (!isValidUrl(targetUrl)) {
    return res.status(400).json({ success: false, message: "URL media tidak valid." });
  }

  try {
    const upstream = await axios.get(targetUrl, {
      responseType: "stream",
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        "User-Agent": randomUserAgent(),
        Accept: "*/*",
      },
      validateStatus: (status) => status < 400,
    });

    res.setHeader(
      "Content-Type",
      upstream.headers["content-type"] || "application/octet-stream"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (upstream.headers["content-length"]) {
      res.setHeader("Content-Length", upstream.headers["content-length"]);
    }

    upstream.data.pipe(res);
    upstream.data.on("error", (err) => {
      logger.error("Stream proxy error", { error: err.message, url: targetUrl });
      if (!res.headersSent) res.status(502).end();
    });
  } catch (err) {
    logger.error("Gagal proxy download", { error: err.message, url: targetUrl });
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: "Gagal mengunduh media dari sumber. Coba lagi beberapa saat lagi.",
      });
    }
  }
}

module.exports = { handleProxyDownload };
