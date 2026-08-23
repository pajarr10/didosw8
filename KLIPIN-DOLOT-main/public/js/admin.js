/* ==========================================================================
   KLIPIN — admin.js
   Login admin + polling statistik realtime + render Chart.js.
   Lengkap: platform, negara, browser, OS, device, IP, dan URL yang diunduh
   user (bisa diklik/dikunjungi langsung).
   ========================================================================== */

(function () {
  "use strict";

  const TOKEN_KEY = "klipin_admin_token";
  const loginSection = document.getElementById("admin-login");
  const dashboardSection = document.getElementById("admin-dashboard");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginError = document.getElementById("login-error");

  let charts = {};
  let pollTimer = null;

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function showDashboard() {
    loginSection.style.display = "none";
    dashboardSection.classList.add("visible");
    fetchStats();
    pollTimer = setInterval(fetchStats, 8000); // realtime polling tiap 8 detik
  }

  function showLogin() {
    dashboardSection.classList.remove("visible");
    loginSection.style.display = "block";
    clearInterval(pollTimer);
  }

  loginBtn?.addEventListener("click", async () => {
    const publicKey = document.getElementById("login-publickey").value.trim();
    const password = document.getElementById("login-password").value.trim();
    loginError.style.display = "none";

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, password }),
      });
      const data = await res.json();
      if (!data.success) {
        loginError.textContent = data.message || "Login gagal.";
        loginError.style.display = "block";
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, data.token);
      showDashboard();
    } catch {
      loginError.textContent = "Terjadi kesalahan jaringan.";
      loginError.style.display = "block";
    }
  });

  logoutBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
  });

  async function fetchStats() {
    const token = getToken();
    if (!token) return showLogin();

    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-key": token },
      });
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        return showLogin();
      }
      const data = await res.json();
      if (data.success) renderStats(data);
    } catch {
      /* silent fail, coba lagi di polling berikutnya */
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderStats(data) {
    // Diagnostik: kasih tahu jelas kalau Redis belum tersambung, ini
    // penyebab paling umum kenapa dashboard kelihatan kosong terus.
    const redisWarning = document.getElementById("redis-warning");
    if (redisWarning) {
      redisWarning.style.display = data.redisConfigured ? "none" : "flex";
    }

    const hasAnyData = Number(data.total) > 0 || Number(data.totalLogsAnalyzed) > 0;
    const emptyState = document.getElementById("empty-state");
    const mainContent = [
      document.querySelector(".stat-grid"),
      document.querySelector("#admin-dashboard .chart-grid"),
      document.getElementById("detail-bar"),
    ];
    document.querySelectorAll(".chart-grid, .log-table-wrap").forEach((el) => {
      el.style.display = hasAnyData ? "" : "none";
    });
    if (emptyState) emptyState.style.display = hasAnyData ? "none" : "block";

    document.getElementById("stat-total").textContent = data.total;
    document.getElementById("stat-today").textContent = data.today;
    document.getElementById("stat-success").textContent = data.statusCount.success || 0;
    document.getElementById("stat-error").textContent = data.statusCount.error || 0;

    // Detail bar
    const logCountEl = document.getElementById("detail-log-count");
    const successRateEl = document.getElementById("detail-success-rate");
    const topPlatformEl = document.getElementById("detail-top-platform");
    const lastUpdatedEl = document.getElementById("detail-last-updated");
    if (logCountEl) logCountEl.textContent = data.totalLogsAnalyzed ?? 0;
    if (successRateEl) successRateEl.textContent = (data.successRate ?? 0) + "%";
    if (topPlatformEl) {
      topPlatformEl.textContent = data.topPlatform
        ? `${data.topPlatform.name} (${data.topPlatform.count}x)`
        : "-";
    }
    if (lastUpdatedEl && data.lastUpdated) {
      lastUpdatedEl.textContent = new Date(data.lastUpdated).toLocaleTimeString("id-ID");
    }

    if (!hasAnyData) return; // gak perlu render chart kalau memang belum ada data

    renderHourlyChart(data.hourly);
    renderPlatformChart(data.platformCounts);
    renderBrowserChart(data.browserCounts);
    renderOsChart(data.osCounts);
    renderStatusChart(data.statusCount);

    renderTopUrls(data.topUrls);
    renderTopIps(data.topIps);
    renderCountryDevice(data.countryCounts, data.deviceCounts);
    renderLogTable(data.logs);
  }

  function upsertChart(id, config) {
    const ctx = document.getElementById(id);
    if (!ctx) return;

    if (typeof Chart === "undefined") {
      const box = ctx.closest(".chart-box");
      if (box && !box.querySelector(".chart-fallback")) {
        const warn = document.createElement("div");
        warn.className = "chart-fallback";
        warn.style.cssText =
          "font-size:9px;color:var(--danger);line-height:1.9;padding:10px;border-left:2px solid var(--danger);background:var(--panel-dark);";
        warn.textContent =
          "\u26A0 Gagal memuat library grafik (Chart.js). Kemungkinan diblokir ad-blocker / ekstensi browser (mis. Brave Shields). Coba matikan sebentar atau pakai browser lain.";
        ctx.style.display = "none";
        box.appendChild(warn);
      }
      return;
    }

    if (charts[id]) {
      charts[id].data = config.data;
      charts[id].update();
      return;
    }
    charts[id] = new Chart(ctx, config);
  }

  const CHART_TEXT = "#c6c6c6";
  const CHART_GRID = "rgba(255,255,255,0.08)";

  function renderHourlyChart(hourly) {
    const labels = Object.keys(hourly).map((h) => `${h}:00`);
    const values = Object.values(hourly);
    upsertChart("chart-hourly", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Request",
            data: values,
            borderColor: "#6ecb63",
            backgroundColor: "rgba(110,203,99,0.18)",
            tension: 0.35,
            fill: true,
            pointRadius: 2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
          x: { ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
        },
      },
    });
  }

  function renderPlatformChart(platformCounts) {
    const labels = Object.keys(platformCounts);
    const values = Object.values(platformCounts);
    upsertChart("chart-platform", {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ["#6ecb63", "#57a3e3", "#e35b5b", "#e3c157", "#a866e3", "#e38ac1", "#66d1c7", "#999999"],
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 9 }, color: CHART_TEXT } } },
      },
    });
  }

  function renderBrowserChart(browserCounts) {
    upsertChart("chart-browser", {
      type: "bar",
      data: {
        labels: Object.keys(browserCounts),
        datasets: [
          {
            label: "Browser",
            data: Object.values(browserCounts),
            backgroundColor: "#57a3e3",
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
          x: { ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
        },
      },
    });
  }

  function renderOsChart(osCounts) {
    upsertChart("chart-os", {
      type: "bar",
      data: {
        labels: Object.keys(osCounts),
        datasets: [
          {
            label: "OS",
            data: Object.values(osCounts),
            backgroundColor: "#e3c157",
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
          y: { ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
        },
      },
    });
  }

  function renderStatusChart(statusCount) {
    upsertChart("chart-status", {
      type: "line",
      data: {
        labels: ["Sukses", "Error"],
        datasets: [
          {
            label: "Jumlah",
            data: [statusCount.success || 0, statusCount.error || 0],
            borderColor: "#e35b5b",
            backgroundColor: "rgba(227,91,91,0.25)",
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
          x: { ticks: { color: CHART_TEXT }, grid: { color: CHART_GRID } },
        },
      },
    });
  }

  function renderTopUrls(topUrls) {
    const el = document.getElementById("top-url-list");
    if (!el) return;
    el.innerHTML =
      (topUrls || [])
        .map(
          (t) => `
      <div>
        <a href="${t.url}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t.url)}" style="color:var(--accent);text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;display:inline-block;">${escapeHtml(t.url)}</a>
        <strong>${t.count}x</strong>
      </div>`
        )
        .join("") || "<em>Belum ada data.</em>";
  }

  function renderTopIps(topIps) {
    const el = document.getElementById("ip-list");
    if (!el) return;
    el.innerHTML =
      (topIps || [])
        .map((t) => `<div><span>&#128225; ${escapeHtml(t.ip)}</span><strong>${t.count}x</strong></div>`)
        .join("") || "<em>Belum ada data.</em>";
  }

  function renderCountryDevice(countryCounts, deviceCounts) {
    const el = document.getElementById("country-device-list");
    if (!el) return;
    const countryRows = Object.entries(countryCounts || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<div><span>&#127760; ${escapeHtml(k)}</span><strong>${v}</strong></div>`)
      .join("");
    const deviceRows = Object.entries(deviceCounts || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<div><span>&#128241; ${escapeHtml(k)}</span><strong>${v}</strong></div>`)
      .join("");
    el.innerHTML = countryRows + deviceRows || "<em>Belum ada data.</em>";
  }

  function renderLogTable(logs) {
    const tbody = document.getElementById("log-table-body");
    if (!tbody) return;
    tbody.innerHTML = (logs || [])
      .slice(0, 40)
      .map(
        (l) => `
      <tr>
        <td>${new Date(l.timestamp).toLocaleString("id-ID")}</td>
        <td>${escapeHtml(l.platform)}</td>
        <td><a href="${l.url || "#"}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(l.url)}" style="color:var(--accent);text-decoration:underline;">${l.url ? "Kunjungi &#8599;" : "-"}</a></td>
        <td>${escapeHtml(l.ip)}</td>
        <td>${escapeHtml(l.country)}</td>
        <td>${escapeHtml(l.browser)}</td>
        <td>${escapeHtml(l.os)}</td>
        <td>${escapeHtml(l.device)}</td>
        <td><span class="badge ${l.status === "success" ? "success" : "error"}">${escapeHtml(l.status)}</span></td>
      </tr>`
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (getToken()) showDashboard();
  });
})();
