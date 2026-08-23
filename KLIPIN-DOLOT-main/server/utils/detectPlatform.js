const PATTERNS = [
  { key: "tiktok", test: /tiktok\.com|vt\.tiktok|vm\.tiktok/i, label: "TikTok" },
  { key: "youtube", test: /youtube\.com|youtu\.be/i, label: "YouTube" },
  { key: "instagram", test: /instagram\.com/i, label: "Instagram" },
  { key: "douyin", test: /douyin\.com/i, label: "Douyin" },
  { key: "pinterest", test: /pinterest\.com|pin\.it/i, label: "Pinterest" },
  { key: "facebook", test: /facebook\.com|fb\.watch/i, label: "Facebook" },
  { key: "capcut", test: /capcut\.com/i, label: "CapCut" },
  { key: "spotify", test: /spotify\.com/i, label: "Spotify" },
];

function detectPlatform(url = "") {
  for (const p of PATTERNS) {
    if (p.test.test(url)) return { key: p.key, label: p.label };
  }
  return { key: "unknown", label: "Tidak diketahui" };
}

module.exports = { detectPlatform };
