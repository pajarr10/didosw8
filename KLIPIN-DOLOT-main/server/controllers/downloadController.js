const axios = require("axios");
const { randomUserAgent } = require("../utils/userAgents");
const { detectPlatform } = require("../utils/detectPlatform");
const { sanitizeUrl } = require("../utils/sanitizeUrl");
const { downloadCache } = require("../utils/cache");
const { logger, recordStat } = require("../utils/logger");

const UPSTREAM_URL =
  process.env.API_URL || "https://api.ikyyxd.my.id/download/all-in-one";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 800;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Memanggil endpoint scraper upstream dengan:
 * - timeout
 * - retry + backoff
 * - random user-agent per percobaan
 */
async function fetchFromUpstream(targetUrl) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const { data } = await axios.get(UPSTREAM_URL, {
        params: { url: targetUrl },
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          "User-Agent": randomUserAgent(),
          Accept: "application/json",
        },
      });
      return data;
    } catch (err) {
      lastError = err;
      logger.warn(`Upstream gagal (percobaan ${attempt}/${MAX_RETRY})`, {
        message: err.message,
      });
      if (attempt < MAX_RETRY) {
        await sleep(RETRY_DELAY_MS * attempt); // backoff bertingkat
      }
    }
  }

  throw lastError || new Error("Upstream gagal tanpa keterangan error");
}

/**
 * Normalisasi respon upstream (yang formatnya bisa berubah-ubah)
 * menjadi bentuk konsisten yang mudah dipakai frontend.
 */
function normalizeResponse(raw, platform) {
  // Upstream (ikyyxd) biasanya membungkus hasil dalam `data` atau `result`.
  const payload = raw?.data || raw?.result || raw || {};

  const title =
    payload.title || payload.desc || payload.caption || payload.description || "Tanpa judul";
  const author =
    payload.author?.nickname ||
    payload.author?.name ||
    payload.author ||
    payload.username ||
    "Tidak diketahui";
  const thumbnail =
    payload.thumbnail || payload.cover || payload.image || payload.thumb || null;

  const stats = {
    like: payload.like_count ?? payload.stats?.likeCount ?? null,
    comment: payload.comment_count ?? payload.stats?.commentCount ?? null,
    share: payload.share_count ?? payload.stats?.shareCount ?? null,
    play: payload.play_count ?? payload.stats?.playCount ?? null,
  };

  // Kumpulkan semua kemungkinan media ke satu daftar seragam.
  const medias = [];

  const pushMedia = (label, url, type) => {
    if (url) medias.push({ label, url, type });
  };

  pushMedia("Video HD", payload.hd || payload.video_hd || payload.videoHD, "video");
  pushMedia(
    "No Watermark",
    payload.no_watermark || payload.nowm || payload.video_no_wm || payload.video,
    "video"
  );
  pushMedia("Watermark", payload.watermark || payload.wm || payload.video_wm, "video");
  pushMedia("MP3 / Audio", payload.music || payload.audio || payload.mp3, "audio");

  if (Array.isArray(payload.images)) {
    payload.images.forEach((img, i) =>
      pushMedia(`Foto ${i + 1}`, typeof img === "string" ? img : img.url, "image")
    );
  }
  if (Array.isArray(payload.medias)) {
    payload.medias.forEach((m) =>
      pushMedia(m.label || m.quality || "Media", m.url, m.type || "video")
    );
  }
  if (Array.isArray(payload.urls)) {
    payload.urls.forEach((m, i) =>
      pushMedia(m.label || m.quality || `Media ${i + 1}`, m.url || m, m.type || "video")
    );
  }

  return {
    success: true,
    platform: platform.label,
    title,
    author,
    thumbnail,
    stats,
    medias: medias.filter((m) => m.url),
  };
}

async function handleDownload(req, res) {
  const rawUrl = (req.query.url || "").trim();

  if (!isValidUrl(rawUrl)) {
    const platform = detectPlatform(rawUrl);
    const meta = req.meta || {};
    await recordStat({ ...meta, platform: platform.key, url: rawUrl, status: "error", errorMessage: "URL tidak valid" });
    return res.status(400).json({
      success: false,
      message: "URL tidak valid. Pastikan tautan diawali http:// atau https://",
    });
  }

  const targetUrl = sanitizeUrl(rawUrl);
  const platform = detectPlatform(targetUrl);
  const meta = req.meta || {};

  const cacheKey = targetUrl;
  const cached = downloadCache.get(cacheKey);
  if (cached) {
    await recordStat({ ...meta, platform: platform.key, url: targetUrl, status: "success" });
    return res.json({ ...cached, cached: true });
  }

  try {
    const raw = await fetchFromUpstream(targetUrl);
    const normalized = normalizeResponse(raw, platform);

    if (!normalized.medias.length) {
      await recordStat({
        ...meta,
        platform: platform.key,
        url: targetUrl,
        status: "error",
        errorMessage: "Media tidak ditemukan",
      });
      return res.status(404).json({
        success: false,
        message: "Media tidak ditemukan atau tautan tidak didukung.",
      });
    }

    downloadCache.set(cacheKey, normalized);
    await recordStat({ ...meta, platform: platform.key, url: targetUrl, status: "success" });

    return res.json(normalized);
  } catch (err) {
    logger.error("Gagal memproses download", { error: err.message, url: targetUrl });
    await recordStat({
      ...meta,
      platform: platform.key,
      url: targetUrl,
      status: "error",
      errorMessage: err.message,
    });
    return res.status(502).json({
      success: false,
      message: "Gagal mengambil data dari server sumber. Coba lagi beberapa saat lagi.",
    });
  }
}

module.exports = { handleDownload, isValidUrl, normalizeResponse };
