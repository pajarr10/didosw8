# Klipin — Universal Media Downloader (Tema Minecraft)

Downloader media universal (TikTok, YouTube, Instagram, Douyin, Pinterest,
Facebook, CapCut, Spotify) dengan frontend HTML/CSS/JS murni bertema
Minecraft, backend Node.js + Express, statistik realtime via Upstash Redis,
dan bot Telegram monitoring.

## 1. Instalasi

```bash
cd klipin
cp .env.example .env
# isi UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, dll di .env
npm install
npm start
```

Server berjalan di `http://localhost:3000`.

> Catatan: jika `UPSTASH_REDIS_REST_URL` / `TOKEN` belum diisi, server tetap
> berjalan normal — statistik otomatis memakai penyimpanan in-memory
> (khusus development, akan reset saat server restart).

## 2. Struktur Folder

```
public/               -> seluruh frontend statis (HTML terpisah per halaman)
  index.html
  cara-penggunaan/
  larangan/
  donasi/
  adm/
  css/style.css
  js/app.js            -> loading screen, theme switcher, PWA popup
  js/download.js        -> logic form unduh di beranda
  js/admin.js            -> logic dashboard admin + Chart.js
  manifest.json, sw.js, offline.html, robots.txt, sitemap.xml

server/
  index.js              -> entry point Express
  routes/                -> definisi endpoint
  controllers/           -> logic bisnis (wrapper scraper, statistik)
  middlewares/           -> rate limiter, request meta (IP/UA/geo)
  config/redis.js        -> wrapper Upstash REST + fallback in-memory
  utils/                 -> cache, logger, user-agent, deteksi platform

bot.js                  -> bot Telegram monitoring (jalan terpisah)
.env.example
```

## 3. Endpoint API

`GET /api/download?url=<encoded_url>`

Response sukses:
```json
{
  "success": true,
  "platform": "TikTok",
  "title": "...",
  "author": "...",
  "thumbnail": "https://...",
  "stats": { "like": 100, "comment": 10, "share": 5, "play": 2000 },
  "medias": [
    { "label": "No Watermark", "url": "https://...", "type": "video" }
  ]
}
```

`GET /api/admin/stats` (header `x-admin-key: <token>`) — statistik lengkap
untuk dashboard admin.

`POST /api/admin/login` — body `{ "publicKey": "pajar", "password": "pajar" }`.

## 4. Bot Telegram

Bot Telegram **tidak lagi bagian dari proyek ini**. Sekarang ada di paket
terpisah `klipin-bot/` (lihat `klipin-bot/README.md`) supaya bisa dijalankan
mandiri di Termux tanpa ikut ter-deploy ke Vercel. Bot hanya perlu
`UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` yang **sama** dengan
punya web ini, karena keduanya berbagi data statistik lewat Redis.

## 4b. Deploy Web ke Vercel

```bash
npm i -g vercel
cd klipin
vercel        # ikuti prompt, atau `vercel --prod` untuk production
```

Set environment variables di dashboard Vercel (Project Settings → Environment
Variables): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `API_URL`,
`ADMIN_KEY`, `ADMIN_PUBLIC_KEY`, `ADMIN_PASSWORD`. File `vercel.json` sudah
disediakan agar Express (`server/index.js`) berjalan sebagai serverless
function dan folder `public/` disajikan sebagai static assets.

## 5. Kredensial Default Admin (`/adm`)

- Key Public: `pajar`
- Password: `pajar`

**Wajib diganti** melalui `ADMIN_PUBLIC_KEY` / `ADMIN_PASSWORD` di `.env`
sebelum deploy ke production.

## 6. Catatan Ikon & Font

- Folder `public/assets/icons/` perlu diisi ikon PWA (`icon-192.png`,
  `icon-512.png`, `icon-maskable-512.png`, `favicon-16.png`, `favicon-32.png`)
  serta `public/assets/og-image.png` untuk Open Graph — ganti sesuai brand.
- Font pixel memakai "Press Start 2P" (via `@font-face` di `style.css`,
  fallback ke font lokal bernama sama atau monospace) sebagai pendekatan
  paling mirip dengan font asli Minecraft ("Minecraftia" berlisensi terbatas
  dan tidak didistribusikan ulang di sini).
