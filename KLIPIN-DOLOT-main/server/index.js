require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");

const requestMeta = require("./middlewares/requestMeta");
const { globalLimiter } = require("./middlewares/rateLimiter");
const downloadRoutes = require("./routes/download");
const statsRoutes = require("./routes/stats");
const { logger } = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.set("trust proxy", 1);

// ---- Security & perf middlewares ----
app.use(
  helmet({
    contentSecurityPolicy: false, // dikontrol manual lewat meta tag di HTML
  })
);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));
app.use(globalLimiter);
app.use(requestMeta);

// ---- Static frontend ----
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ["html"],
    maxAge: "1d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// ---- API ----
app.use("/api", downloadRoutes);
app.use("/api", statsRoutes);

// ---- Halaman bersih tanpa .html (SSR-like routing statis) ----
const pages = ["cara-penggunaan", "larangan", "donasi", "adm"];
pages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, page, "index.html"));
  });
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", time: new Date().toISOString() });
});

// ---- 404 handler ----
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    logger.warn("404 API tidak ditemukan", {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
    });
    return res.status(404).json({ success: false, message: "Endpoint tidak ditemukan." });
  }
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"), (err) => {
    if (err) res.status(404).send("404 - Halaman tidak ditemukan");
  });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message });
  res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
});

// Saat dijalankan lokal / VPS (npm start), aktifkan listener biasa.
// Saat di-deploy ke Vercel, file ini diimpor sebagai serverless function
// (lihat vercel.json) sehingga app.listen() tidak dipanggil.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    logger.info(`Klipin server berjalan di port ${PORT}`);
  });
}

module.exports = app;
