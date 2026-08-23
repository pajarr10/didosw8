/* ==========================================================================
   KLIPIN — download.js
   Form input URL -> /api/download -> render hasil -> unduh otomatis
   lewat /api/proxy (same-origin, langsung trigger download, bukan tab baru).
   ========================================================================== */

(function () {
  "use strict";

  const form = document.getElementById("download-form");
  const input = document.getElementById("url-input");
  const pasteBtn = document.getElementById("paste-btn");
  const submitBtn = document.getElementById("submit-btn");
  const resultBox = document.getElementById("result");
  const progressWrap = document.getElementById("progress-wrap");
  const progressFill = document.getElementById("progress-fill");
  const dialogOverlay = document.getElementById("error-dialog");
  const dialogMessage = document.getElementById("dialog-message");
  const dialogClose = document.getElementById("dialog-close");

  if (!form) return;

  dialogClose?.addEventListener("click", () => dialogOverlay?.classList.remove("show"));
  dialogOverlay?.addEventListener("click", (e) => {
    if (e.target === dialogOverlay) dialogOverlay.classList.remove("show");
  });

  function showError(message) {
    if (dialogOverlay && dialogMessage) {
      dialogMessage.textContent = message;
      dialogOverlay.classList.add("show");
    } else {
      window.KlipinToast?.(message);
    }
  }

  pasteBtn?.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      input.value = text;
      input.focus();
    } catch {
      window.KlipinToast?.("Gagal menempel. Izinkan akses clipboard di browser.");
    }
  });

  function mediaTypeIcon(type) {
    if (type === "audio") return "\u266A";
    if (type === "image") return "\u25A3";
    return "\u25B6";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Trigger unduhan langsung (auto-download) lewat endpoint proxy backend,
   * bukan membuka tab baru / halaman preview eksternal.
   */
  function triggerAutoDownload(mediaUrl, label, type) {
    const filename = `klipin-${(label || "media").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(
      filename
    )}&type=${encodeURIComponent(type || "video")}`;

    const a = document.createElement("a");
    a.href = proxyUrl;
    a.setAttribute("download", "");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.KlipinToast?.("Mengunduh " + label + "...");
  }

  function renderResult(data) {
    const stats = data.stats || {};
    const statItems = [
      stats.play != null ? `\u25B6 ${stats.play}` : null,
      stats.like != null ? `\u2665 ${stats.like}` : null,
      stats.comment != null ? `\u2709 ${stats.comment}` : null,
      stats.share != null ? `\u21D7 ${stats.share}` : null,
    ].filter(Boolean);

    resultBox.innerHTML = `
      <div class="panel pixel-corners">
        <div class="result-header">
          ${data.thumbnail ? `<img class="result-thumb" src="${data.thumbnail}" alt="Thumbnail" loading="lazy" referrerpolicy="no-referrer" />` : ""}
          <div class="result-meta">
            <div class="result-title">${escapeHtml(data.title || "Tanpa judul")}</div>
            <div class="result-sub">${escapeHtml(data.author || "Tidak diketahui")} &middot; ${escapeHtml(data.platform || "")}</div>
            ${statItems.length ? `<div class="result-stats">${statItems.map((s) => `<span class="result-stat">${s}</span>`).join("")}</div>` : ""}
          </div>
        </div>
        <div class="media-list" id="media-list"></div>
      </div>
    `;

    const mediaListEl = resultBox.querySelector("#media-list");
    data.medias.forEach((m, i) => {
      const item = document.createElement("div");
      item.className = "media-item";
      item.innerHTML = `
        <div class="media-item-info">
          <span class="media-tag">${mediaTypeIcon(m.type)} ${m.type || "media"}</span>
          <span class="media-quality">${escapeHtml(m.label)}</span>
        </div>
        <button type="button" class="pixel-btn primary sm dl-btn">UNDUH</button>
      `;
      item.querySelector(".dl-btn").addEventListener("click", () => {
        triggerAutoDownload(m.url, m.label, m.type);
      });
      mediaListEl.appendChild(item);
    });

    resultBox.classList.add("show");
    resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span class="spinner"></span> MEMPROSES...'
      : "PROSES SEKARANG \u2B07";
    if (progressWrap) {
      progressWrap.classList.toggle("active", loading);
      if (progressFill) progressFill.style.width = loading ? "70%" : "0%";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = input.value.trim();
    if (!url) {
      window.KlipinToast?.("Masukkan tautan terlebih dahulu.");
      return;
    }

    setLoading(true);
    resultBox.classList.remove("show");

    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data.success) {
        showError(data.message || "Gagal memproses tautan. Pastikan tautan valid dan publik.");
        return;
      }
      if (progressFill) progressFill.style.width = "100%";
      renderResult(data);
    } catch (err) {
      showError("Terjadi kesalahan jaringan. Periksa koneksi internet lalu coba lagi.");
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  });
})();
