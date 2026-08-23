const { UAParser } = require("ua-parser-js");
const geoip = require("geoip-lite");

/**
 * Menempelkan req.meta berisi IP, negara, browser, OS, device, referer
 * agar dipakai konsisten oleh controller & logger.
 */
function requestMeta(req, res, next) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "0.0.0.0";

  const uaString = req.headers["user-agent"] || "";
  const parser = new UAParser(uaString);
  const ua = parser.getResult();

  const geo = geoip.lookup(ip.replace("::ffff:", ""));

  req.meta = {
    ip,
    country: geo?.country || "Unknown",
    userAgent: uaString,
    browser: ua.browser.name || "Unknown",
    os: ua.os.name || "Unknown",
    device: ua.device.type
      ? ua.device.type.charAt(0).toUpperCase() + ua.device.type.slice(1)
      : "Desktop",
    referer: req.headers["referer"] || req.headers["referrer"] || "Direct",
  };

  next();
}

module.exports = requestMeta;
