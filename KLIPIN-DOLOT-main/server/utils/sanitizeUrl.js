/**
 * Membersihkan tracking/query parameter yang tidak perlu dari URL sosial media
 * (igsh, si, utm_*, fbclid, dll) supaya upstream scraper tidak gagal parsing,
 * dan supaya cache key konsisten untuk link yang sebenarnya sama.
 */
const TRACKING_PARAMS = [
  "igsh", "igshid", "si", "feature", "fbclid", "gclid",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "is_from_webapp", "sender_device", "web_id",
];

function sanitizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl.trim());
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    let cleaned = u.toString();
    if (cleaned.endsWith("?")) cleaned = cleaned.slice(0, -1);
    return cleaned;
  } catch {
    return rawUrl.trim();
  }
}

module.exports = { sanitizeUrl };
