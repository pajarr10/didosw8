/* ==========================================================================
   KLIPIN — app.js
   Logic bersama: loading screen, theme switcher, menu titik tiga, PWA, toast.
   ========================================================================== */

(function () {
  "use strict";

  const THEME_KEY = "klipin_theme";
  const DEFAULT_THEME = "hitam";
  const VALID_THEMES = ["hitam", "abu", "putih", "merah", "hijau", "biru"];

  /* ---- Loading screen ala Mojang ---- */
  function initLoadingScreen() {
    const screen = document.getElementById("loading-screen");
    const fill = document.getElementById("loading-bar-fill");
    if (!screen) return;

    let progress = 0;
    const tick = setInterval(() => {
      progress += Math.random() * 18;
      if (progress > 92) progress = 92;
      if (fill) fill.style.width = progress + "%";
    }, 120);

    window.addEventListener("load", () => {
      clearInterval(tick);
      if (fill) fill.style.width = "100%";
      setTimeout(() => {
        screen.classList.add("hidden");
        setTimeout(() => screen.remove(), 700);
      }, 350);
    });
  }

  /* ---- Theme switcher ---- */
  function applyTheme(theme) {
    if (theme === "abu") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    document.querySelectorAll(".theme-option, .theme-swatch").forEach((el) => {
      el.classList.toggle("active", el.dataset.theme === theme);
    });
  }

  function initThemeSwitcher() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = VALID_THEMES.includes(saved) ? saved : DEFAULT_THEME;
    if (!saved) localStorage.setItem(THEME_KEY, DEFAULT_THEME);
    applyTheme(theme);

    function setTheme(t) {
      localStorage.setItem(THEME_KEY, t);
      applyTheme(t);
      window.KlipinToast?.("Tema diganti ke " + t.toUpperCase());
    }

    document.querySelectorAll(".theme-option, .theme-swatch").forEach((el) => {
      el.addEventListener("click", () => setTheme(el.dataset.theme));
    });

    // Modal tema (Options)
    const optionsBtn = document.getElementById("options-btn");
    const optionsOverlay = document.getElementById("options-overlay");
    const optionsClose = document.getElementById("options-close");
    optionsBtn?.addEventListener("click", () => optionsOverlay?.classList.add("show"));
    optionsClose?.addEventListener("click", () => optionsOverlay?.classList.remove("show"));
    optionsOverlay?.addEventListener("click", (e) => {
      if (e.target === optionsOverlay) optionsOverlay.classList.remove("show");
    });
  }

  /* ---- Menu titik tiga (nav) ---- */
  function initDotsMenu() {
    const btn = document.getElementById("dots-btn");
    const menu = document.getElementById("dots-menu");
    const closeBtn = document.getElementById("dots-menu-close");
    if (!btn || !menu) return;

    btn.addEventListener("click", () => menu.classList.add("open"));
    closeBtn?.addEventListener("click", () => menu.classList.remove("open"));
    menu.addEventListener("click", (e) => {
      if (e.target === menu) menu.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") menu.classList.remove("open");
    });
  }

  /* ---- Toast ---- */
  function showToast(message, duration = 2600) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("visible"), duration);
  }
  window.KlipinToast = showToast;

  /* ---- Service worker registration ---- */
  function initServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }

  /* ---- PWA install popup ---- */
  function initPwaInstall() {
    const popup = document.getElementById("pwa-toast");
    if (!popup) return;
    const btnInstall = document.getElementById("pwa-install-btn");
    const btnClose = document.getElementById("pwa-close-btn");
    let deferredPrompt = null;

    if (sessionStorage.getItem("pwa_popup_dismissed") === "1") return;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => popup.classList.add("show"), 1800);
    });

    btnInstall?.addEventListener("click", async () => {
      popup.classList.remove("show");
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });

    btnClose?.addEventListener("click", () => {
      popup.classList.remove("show");
      sessionStorage.setItem("pwa_popup_dismissed", "1");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLoadingScreen();
    initThemeSwitcher();
    initDotsMenu();
    initServiceWorker();
    initPwaInstall();
  });
})();
