const scatterState = {
  tools: [],
  filteredTools: [],
  selectedLanguage: "All",
  languagesExpanded: false,
  selectedRepoId: null,
  minStars: 0,
  chart: {
    width: 980,
    height: 660,
    padding: {
      top: 34,
      right: 34,
      bottom: 76,
      left: 88,
    },
  },
};

const totalRepos = document.querySelector("#totalRepos");
const medianStars = document.querySelector("#medianStars");
const medianForks = document.querySelector("#medianForks");
const scatterHeadline = document.querySelector("#scatterHeadline");
const scatterSummary = document.querySelector("#scatterSummary");
const scatterCanvas = document.querySelector("#scatterCanvas");
const scatterStage = document.querySelector("#scatterStage");
const scatterTooltip = document.querySelector("#scatterTooltip");
const scatterEmpty = document.querySelector("#scatterEmpty");
const scatterSearchForm = document.querySelector("#scatterSearchForm");
const scatterSearchInput = document.querySelector("#scatterSearchInput");
const minStarsRange = document.querySelector("#minStarsRange");
const minStarsValue = document.querySelector("#minStarsValue");
const languageChips = document.querySelector("#languageChips");
const selectedRepo = document.querySelector("#selectedRepo");
const themeToggle = document.querySelector("#themeToggle");
const themeToggleLabel = document.querySelector("#themeToggleLabel");

function trackEvent(eventName) {
  window.trackClarityEvent?.(eventName);
}

function setTag(key, value) {
  window.setClarityTag?.(key, value);
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  themeToggleLabel.textContent = nextTheme === "dark" ? "淺色" : "深色";
  localStorage.setItem("gafy-theme", nextTheme);
  setTag("theme", nextTheme);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-TW").format(Math.round(value || 0));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function log10(value) {
  return Math.log10(Math.max(1, value));
}

function scaleLinear(value, domainMin, domainMax, rangeMin, rangeMax) {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const ratio = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

function getChartBounds() {
  const { width, height, padding } = scatterState.chart;
  return {
    left: padding.left,
    right: width - padding.right,
    top: padding.top,
    bottom: height - padding.bottom,
  };
}

function getDomains(tools) {
  const source = tools.length ? tools : scatterState.tools;
  const starValues = source.map((tool) => log10(tool.stars));
  const forkValues = source.map((tool) => log10(tool.forks));
  return {
    stars: [Math.min(...starValues), Math.max(...starValues)],
    forks: [Math.min(...forkValues), Math.max(...forkValues)],
  };
}

function classifyTool(tool) {
  const forkRatio = tool.forks / Math.max(1, tool.stars);
  if (forkRatio >= 0.18) return "technical";
  if (tool.stars >= scatterState.stats.medianStars * 1.3 && forkRatio <= 0.08) return "popular";
  return "balanced";
}

function pointRadius(tool) {
  const maxStars = scatterState.stats.maxStars || 1;
  return scaleLinear(log10(tool.stars), 0, log10(maxStars), 4.2, 10.8);
}

function renderStats() {
  const stars = scatterState.tools.map((tool) => tool.stars);
  const forks = scatterState.tools.map((tool) => tool.forks);
  scatterState.stats = {
    medianStars: median(stars),
    medianForks: median(forks),
    maxStars: Math.max(...stars, 1),
    maxForks: Math.max(...forks, 1),
  };

  totalRepos.textContent = formatNumber(scatterState.tools.length);
  medianStars.textContent = formatNumber(scatterState.stats.medianStars);
  medianForks.textContent = formatNumber(scatterState.stats.medianForks);
}

function renderLanguageChips() {
  const counts = new Map();
  scatterState.tools.forEach((tool) => counts.set(tool.language, (counts.get(tool.language) || 0) + 1));
  const allLanguages = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const visibleLanguages = scatterState.languagesExpanded ? allLanguages : allLanguages.slice(0, 10);
  const hiddenCount = Math.max(0, allLanguages.length - visibleLanguages.length);

  languageChips.innerHTML = [
    `<button class="scatter-chip${scatterState.selectedLanguage === "All" ? " is-active" : ""}" type="button" data-language="All">All</button>`,
    ...visibleLanguages.map(
      ([language, count]) =>
        `<button class="scatter-chip${scatterState.selectedLanguage === language ? " is-active" : ""}" type="button" data-language="${escapeHtml(language)}">${escapeHtml(
          language
        )} ${formatNumber(count)}</button>`
    ),
    allLanguages.length > 10
      ? `<button class="scatter-chip scatter-chip--more" type="button" data-language-toggle="true">${
          scatterState.languagesExpanded ? "收合" : `更多 ${formatNumber(hiddenCount)}`
        }</button>`
      : "",
  ].join("");
}

function applyFilters() {
  const query = scatterSearchInput.value.trim().toLowerCase();
  scatterState.minStars = Number(minStarsRange.value || 0);
  scatterState.filteredTools = scatterState.tools.filter((tool) => {
    const matchesStars = tool.stars >= scatterState.minStars;
    const matchesLanguage = scatterState.selectedLanguage === "All" || tool.language === scatterState.selectedLanguage;
    const haystack = [tool.name, tool.full_name, tool.owner, tool.language, tool.description].join(" ").toLowerCase();
    return matchesStars && matchesLanguage && (!query || haystack.includes(query));
  });

  minStarsValue.textContent = formatNumber(scatterState.minStars);
  renderScatterPlot();
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function addText(parent, text, attributes = {}) {
  const element = createSvgElement("text", attributes);
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function niceTicks(maxValue) {
  const maxPower = Math.ceil(log10(maxValue));
  const ticks = [];
  for (let power = 0; power <= maxPower; power += 1) {
    [1, 2, 5].forEach((multiplier) => {
      const value = multiplier * 10 ** power;
      if (value <= maxValue * 1.04 && value >= 1) ticks.push(value);
    });
  }
  return [...new Set(ticks)].filter((value) => value >= 1000 || value === 1).slice(-7);
}

function renderAxes(group, domains) {
  const bounds = getChartBounds();
  const xTicks = niceTicks(scatterState.stats.maxStars).filter((tick) => {
    const value = log10(tick);
    return value >= domains.stars[0] && value <= domains.stars[1];
  });
  const yTicks = niceTicks(scatterState.stats.maxForks).filter((tick) => {
    const value = log10(tick);
    return value >= domains.forks[0] && value <= domains.forks[1];
  });

  group.appendChild(createSvgElement("line", { class: "scatter-axis", x1: bounds.left, x2: bounds.right, y1: bounds.bottom, y2: bounds.bottom }));
  group.appendChild(createSvgElement("line", { class: "scatter-axis", x1: bounds.left, x2: bounds.left, y1: bounds.top, y2: bounds.bottom }));

  xTicks.forEach((tick) => {
    const x = scaleLinear(log10(tick), domains.stars[0], domains.stars[1], bounds.left, bounds.right);
    group.appendChild(createSvgElement("line", { class: "scatter-grid-line", x1: x, x2: x, y1: bounds.top, y2: bounds.bottom }));
    addText(group, formatNumber(tick), { class: "scatter-tick-label", x, y: bounds.bottom + 28, "text-anchor": "middle" });
  });

  yTicks.forEach((tick) => {
    const y = scaleLinear(log10(tick), domains.forks[0], domains.forks[1], bounds.bottom, bounds.top);
    group.appendChild(createSvgElement("line", { class: "scatter-grid-line", x1: bounds.left, x2: bounds.right, y1: y, y2: y }));
    addText(group, formatNumber(tick), { class: "scatter-tick-label", x: bounds.left - 14, y: y + 4, "text-anchor": "end" });
  });

  addText(group, "Stars (log scale)", {
    class: "scatter-axis-label",
    x: (bounds.left + bounds.right) / 2,
    y: scatterState.chart.height - 22,
    "text-anchor": "middle",
  });
  addText(group, "Forks (log scale)", {
    class: "scatter-axis-label",
    x: 22,
    y: (bounds.top + bounds.bottom) / 2,
    transform: `rotate(-90 22 ${(bounds.top + bounds.bottom) / 2})`,
    "text-anchor": "middle",
  });
}

function renderReferenceLines(group, domains) {
  const bounds = getChartBounds();
  const medianStarX = scaleLinear(
    log10(scatterState.stats.medianStars),
    domains.stars[0],
    domains.stars[1],
    bounds.left,
    bounds.right
  );
  const medianForkY = scaleLinear(
    log10(scatterState.stats.medianForks),
    domains.forks[0],
    domains.forks[1],
    bounds.bottom,
    bounds.top
  );

  group.appendChild(createSvgElement("line", { class: "scatter-reference-line", x1: medianStarX, x2: medianStarX, y1: bounds.top, y2: bounds.bottom }));
  group.appendChild(createSvgElement("line", { class: "scatter-reference-line", x1: bounds.left, x2: bounds.right, y1: medianForkY, y2: medianForkY }));
  addText(group, "median stars", { class: "scatter-reference-label", x: medianStarX + 8, y: bounds.top + 18 });
  addText(group, "median forks", { class: "scatter-reference-label", x: bounds.right - 94, y: medianForkY - 8 });
}

function getPointPosition(tool, domains) {
  const bounds = getChartBounds();
  return {
    x: scaleLinear(log10(tool.stars), domains.stars[0], domains.stars[1], bounds.left, bounds.right),
    y: scaleLinear(log10(tool.forks), domains.forks[0], domains.forks[1], bounds.bottom, bounds.top),
  };
}

function renderScatterPlot() {
  scatterCanvas.innerHTML = "";
  const tools = scatterState.filteredTools;
  const hasData = tools.length > 0;
  scatterEmpty.classList.toggle("hidden", hasData);
  scatterHeadline.textContent = hasData ? `${formatNumber(tools.length)} 個 repo 的 fork / star 分布` : "沒有符合條件的 repo";
  scatterSummary.textContent = hasData
    ? "X 軸是 Stars，Y 軸是 Forks；兩軸使用 log scale，避免熱門專案把其他點擠在角落。"
    : "請調整搜尋、語言或最低 stars 篩選。";

  const domains = getDomains(tools);
  const axisGroup = createSvgElement("g");
  renderAxes(axisGroup, domains);
  renderReferenceLines(axisGroup, domains);
  scatterCanvas.appendChild(axisGroup);

  if (!hasData) return;

  const pointGroup = createSvgElement("g");
  tools
    .slice()
    .sort((a, b) => b.stars - a.stars)
    .forEach((tool) => {
      const position = getPointPosition(tool, domains);
      const type = classifyTool(tool);
      const point = createSvgElement("circle", {
        class: `scatter-point scatter-point--${type}${tool.id === scatterState.selectedRepoId ? " is-selected" : ""}`,
        cx: position.x.toFixed(2),
        cy: position.y.toFixed(2),
        r: pointRadius(tool).toFixed(2),
        "data-id": tool.id,
        tabindex: "0",
        role: "button",
        "aria-label": `${tool.full_name}, ${formatNumber(tool.stars)} stars, ${formatNumber(tool.forks)} forks`,
      });
      point.addEventListener("mouseenter", (event) => showTooltip(event, tool));
      point.addEventListener("mousemove", (event) => moveTooltip(event));
      point.addEventListener("mouseleave", hideTooltip);
      point.addEventListener("focus", (event) => showTooltip(event, tool));
      point.addEventListener("blur", hideTooltip);
      point.addEventListener("click", () => selectRepo(tool.id));
      point.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRepo(tool.id);
        }
      });
      pointGroup.appendChild(point);
    });
  scatterCanvas.appendChild(pointGroup);
}

function showTooltip(event, tool) {
  scatterTooltip.innerHTML = `
    <strong>${escapeHtml(tool.full_name)}</strong>
    <span>${formatNumber(tool.stars)} stars · ${formatNumber(tool.forks)} forks · ${escapeHtml(tool.language)}</span>
  `;
  scatterTooltip.classList.remove("hidden");
  moveTooltip(event);
}

function moveTooltip(event) {
  const stageRect = scatterStage.getBoundingClientRect();
  const x = "clientX" in event ? event.clientX - stageRect.left : 24;
  const y = "clientY" in event ? event.clientY - stageRect.top : 24;
  scatterTooltip.style.left = `${Math.min(x + 14, stageRect.width - 280)}px`;
  scatterTooltip.style.top = `${Math.max(12, y - 52)}px`;
}

function hideTooltip() {
  scatterTooltip.classList.add("hidden");
}

function selectRepo(id) {
  const tool = scatterState.tools.find((item) => item.id === id);
  if (!tool) return;
  scatterState.selectedRepoId = id;
  selectedRepo.innerHTML = `
    <p class="results-header__eyebrow">Selected Repo</p>
    <h3>${escapeHtml(tool.full_name)}</h3>
    <p>${escapeHtml(tool.description || "No description")}</p>
    <div class="scatter-selected__metrics">
      <div class="scatter-selected__metric"><strong>${formatNumber(tool.stars)}</strong><span>Stars</span></div>
      <div class="scatter-selected__metric"><strong>${formatNumber(tool.forks)}</strong><span>Forks</span></div>
      <div class="scatter-selected__metric"><strong>${escapeHtml(tool.language)}</strong><span>Language</span></div>
      <div class="scatter-selected__metric"><strong>${((tool.forks / Math.max(1, tool.stars)) * 100).toFixed(1)}%</strong><span>Fork ratio</span></div>
    </div>
    <a class="scatter-selected__link" href="${escapeHtml(tool.html_url)}" target="_blank" rel="noopener noreferrer">開啟 GitHub</a>
  `;
  renderScatterPlot();
  trackEvent("scatter_repo_selected");
}

async function loadScatterData() {
  try {
    const response = await fetch("/api/tools");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    scatterState.tools = (data.items || [])
      .filter((tool) => Number(tool.stars) > 0 && Number(tool.forks) > 0)
      .map((tool) => ({
        ...tool,
        stars: Number(tool.stars || 0),
        forks: Number(tool.forks || 0),
        language: tool.language || "Unknown",
      }));

    const maxStars = Math.max(...scatterState.tools.map((tool) => tool.stars), 0);
    minStarsRange.max = String(Math.ceil(maxStars / 1000) * 1000);
    minStarsRange.step = maxStars > 100000 ? "5000" : "1000";

    renderStats();
    renderLanguageChips();
    applyFilters();
    setTag("scatter_has_data", scatterState.tools.length > 0 ? "true" : "false");
    trackEvent("scatter_loaded");
  } catch (error) {
    scatterHeadline.textContent = "散點圖載入失敗";
    scatterSummary.textContent = "請確認本機 server 已啟動，且 data/tools.db 可以被 /api/tools 讀取。";
    scatterEmpty.classList.remove("hidden");
  }
}

scatterSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyFilters();
});

scatterSearchInput.addEventListener("input", applyFilters);
minStarsRange.addEventListener("input", applyFilters);

languageChips.addEventListener("click", (event) => {
  const button = event.target.closest(".scatter-chip");
  if (!button) return;
  if (button.dataset.languageToggle) {
    scatterState.languagesExpanded = !scatterState.languagesExpanded;
    renderLanguageChips();
    trackEvent("scatter_language_more_toggled");
    return;
  }
  scatterState.selectedLanguage = button.dataset.language;
  languageChips.querySelectorAll(".scatter-chip").forEach((chip) => chip.classList.remove("is-active"));
  button.classList.add("is-active");
  applyFilters();
});

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  trackEvent("theme_toggled");
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("gafy-theme") || "light");
setTag("page_type", "scatterplot");
loadScatterData();
