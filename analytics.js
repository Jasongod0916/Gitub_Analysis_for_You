const rankingState = {
  authors: [],
  languages: [],
};

const totalTools = document.querySelector("#totalTools");
const authorCount = document.querySelector("#authorCount");
const topLanguage = document.querySelector("#topLanguage");
const rankingSummary = document.querySelector("#rankingSummary");
const chartSummary = document.querySelector("#chartSummary");
const leaderboard = document.querySelector("#leaderboard");
const rankingEmpty = document.querySelector("#rankingEmpty");
const languagePie = document.querySelector("#languagePie");
const languageList = document.querySelector("#languageList");
const themeToggle = document.querySelector("#themeToggle");
const themeToggleLabel = document.querySelector("#themeToggleLabel");

const chartColors = [
  "#1c7c72",
  "#d8891c",
  "#4578d4",
  "#d95f5f",
  "#7a63c9",
  "#5e9d6c",
  "#c96f3c",
  "#4f9bb3",
  "#b86a8c",
  "#d1b15a",
];

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  themeToggleLabel.textContent = nextTheme === "dark" ? "深色模式" : "亮色模式";
  localStorage.setItem("gafy-theme", nextTheme);
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW").format(value || 0);
}

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-TW");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderStats(summary) {
  const topLanguageItem = rankingState.languages[0];
  totalTools.textContent = formatNumber(summary.total_tools);
  authorCount.textContent = formatNumber(rankingState.authors.length);
  topLanguage.textContent = topLanguageItem?.language || "--";
}

function renderLeaderboard() {
  if (rankingState.authors.length === 0) {
    leaderboard.innerHTML = "";
    rankingEmpty.classList.remove("hidden");
    return;
  }

  rankingEmpty.classList.add("hidden");
  const topAuthor = rankingState.authors[0];
  rankingSummary.textContent = `${topAuthor.owner} 目前以 ${formatNumber(
    topAuthor.repo_count
  )} 個收錄專案排在第一名，排行榜依專案數排序，stars 作為同名次時的參考。`;

  leaderboard.innerHTML = rankingState.authors
    .map((author) => {
      const projects = author.projects.length
        ? `代表專案：${author.projects.map(escapeHtml).join("、")}`
        : `最近更新：${formatDate(author.latest_update)}`;

      return `
        <article class="leaderboard-row">
          <div class="leaderboard-row__rank">#${author.rank}</div>
          <div class="leaderboard-row__owner">
            <h3>${escapeHtml(author.owner)}</h3>
            <p>${projects}</p>
          </div>
          <div class="leaderboard-row__metrics">
            <div class="leaderboard-metric">
              <strong>${formatNumber(author.repo_count)}</strong>
              <span>Projects</span>
            </div>
            <div class="leaderboard-metric">
              <strong>${formatNumber(author.stars)}</strong>
              <span>Stars</span>
            </div>
            <div class="leaderboard-metric">
              <strong>${formatNumber(author.forks)}</strong>
              <span>Forks</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function getVisibleLanguages() {
  const topLanguages = rankingState.languages.slice(0, 9);
  const rest = rankingState.languages.slice(9);
  const restCount = rest.reduce((sum, item) => sum + item.repo_count, 0);

  if (restCount === 0) return topLanguages;
  return [...topLanguages, { language: "其他", repo_count: restCount, stars: 0 }];
}

function renderLanguageChart() {
  const visibleLanguages = getVisibleLanguages();
  const total = visibleLanguages.reduce((sum, item) => sum + item.repo_count, 0);

  if (total === 0) {
    languagePie.style.background = "conic-gradient(var(--brand) 0deg 360deg)";
    languageList.innerHTML = "";
    chartSummary.textContent = "目前沒有可用的語言資料。";
    return;
  }

  let currentDegree = 0;
  const gradientParts = visibleLanguages.map((item, index) => {
    const degrees = (item.repo_count / total) * 360;
    const start = currentDegree;
    const end = currentDegree + degrees;
    currentDegree = end;
    return `${chartColors[index % chartColors.length]} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });

  languagePie.style.background = `conic-gradient(${gradientParts.join(", ")})`;
  chartSummary.textContent = `共 ${formatNumber(total)} 筆語言資料，前 ${
    visibleLanguages.length
  } 類顯示於圓餅圖。`;

  languageList.innerHTML = visibleLanguages
    .map((item, index) => {
      const percentage = ((item.repo_count / total) * 100).toFixed(1);
      return `
        <div class="language-item">
          <span class="language-swatch" style="background:${chartColors[index % chartColors.length]}"></span>
          <span class="language-name">${escapeHtml(item.language)}</span>
          <span class="language-count">${formatNumber(item.repo_count)} (${percentage}%)</span>
        </div>
      `;
    })
    .join("");
}

async function loadRankings() {
  try {
    const response = await fetch("/api/rankings");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    rankingState.authors = data.authors || [];
    rankingState.languages = data.languages || [];
    renderStats(data.summary || {});
    renderLeaderboard();
    renderLanguageChart();
  } catch (error) {
    rankingSummary.textContent = "讀取排行榜資料失敗，請確認本機伺服器是否已啟動。";
    chartSummary.textContent = "無法載入程式種類資料。";
    leaderboard.innerHTML = "";
    languageList.innerHTML = "";
    rankingEmpty.classList.remove("hidden");
  }
}

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("gafy-theme") || "light");
loadRankings();
