const state = {
  query: "",
  category: "All",
  topic: "All",
  sortBy: "stars",
  viewMode: "grid",
  categoriesExpanded: false,
  topicsExpanded: false,
  projects: [],
};

const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const categoryChips = document.querySelector("#categoryChips");
const topicChips = document.querySelector("#topicChips");
const projectGrid = document.querySelector("#projectGrid");
const emptyState = document.querySelector("#emptyState");
const resultsCount = document.querySelector("#resultsCount");
const resultsSummary = document.querySelector("#resultsSummary");
const projectTotal = document.querySelector("#projectTotal");
const topLanguage = document.querySelector("#topLanguage");
const topTopic = document.querySelector("#topTopic");
const viewSwitch = document.querySelector("#viewSwitch");
const viewMenu = document.querySelector("#viewMenu");
const viewMenuItems = document.querySelectorAll(".view-menu__item");
const themeToggle = document.querySelector("#themeToggle");
const themeToggleLabel = document.querySelector("#themeToggleLabel");

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  themeToggleLabel.textContent = nextTheme === "dark" ? "淺色模式" : "深色模式";
  localStorage.setItem("gafy-theme", nextTheme);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function highlightText(value) {
  const safeValue = escapeHtml(value || "");
  const query = state.query.trim();

  if (!query) return safeValue;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safeValue.replace(new RegExp(`(${escapedQuery})`, "ig"), '<mark class="highlight">$1</mark>');
}

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-TW");
}

function getCategories() {
  const counts = new Map();

  state.projects.forEach((project) => {
    const language = project.language || "Unknown";
    counts.set(language, (counts.get(language) || 0) + 1);
  });

  return [
    "All",
    ...Array.from(counts.entries())
      .sort((first, second) => second[1] - first[1])
      .map(([language]) => language),
  ];
}

function getTopTopics() {
  const counts = new Map();

  state.projects.forEach((project) => {
    (project.topics || []).forEach((topic) => {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    });
  });

  return [
    "All",
    ...Array.from(counts.entries())
      .sort((first, second) => second[1] - first[1])
      .map(([topic]) => topic),
  ];
}

function getMostCommon(items) {
  const counts = new Map();

  items.forEach((item) => {
    if (!item) return;
    counts.set(item, (counts.get(item) || 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((first, second) => second[1] - first[1]);
  return sorted[0]?.[0] || "--";
}

function renderHeroStats() {
  projectTotal.textContent = `${state.projects.length}`;
  topLanguage.textContent = getMostCommon(state.projects.map((project) => project.language));
  topTopic.textContent = getMostCommon(
    state.projects.flatMap((project) => project.topics || [])
  );
}

function renderCategoryChips() {
  categoryChips.innerHTML = "";

  const categories = getCategories();
  const visibleCategories = state.categoriesExpanded
    ? categories
    : [categories[0], ...categories.slice(1, 6)];

  visibleCategories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${state.category === category ? " is-active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      state.category = category;
      renderCategoryChips();
      renderProjects();
    });
    categoryChips.appendChild(button);
  });

  if (categories.length > 6) {
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "chip chip--ghost";
    toggleButton.textContent = state.categoriesExpanded ? "收合" : "更多";
    toggleButton.addEventListener("click", () => {
      state.categoriesExpanded = !state.categoriesExpanded;
      renderCategoryChips();
    });
    categoryChips.appendChild(toggleButton);
  }
}

function renderTopicChips() {
  topicChips.innerHTML = "";

  const topics = getTopTopics();
  const visibleTopics = state.topicsExpanded
    ? topics
    : [topics[0], ...topics.slice(1, 9)];

  visibleTopics.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${state.topic === topic ? " is-active" : ""}`;
    button.textContent = topic;
    button.addEventListener("click", () => {
      state.topic = topic;
      renderTopicChips();
      renderProjects();
    });
    topicChips.appendChild(button);
  });

  if (topics.length > 9) {
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "chip chip--ghost";
    toggleButton.textContent = state.topicsExpanded ? "收合" : "更多";
    toggleButton.addEventListener("click", () => {
      state.topicsExpanded = !state.topicsExpanded;
      renderTopicChips();
    });
    topicChips.appendChild(toggleButton);
  }
}

function getFilteredProjects() {
  const normalizedQuery = state.query.trim().toLowerCase();

  return state.projects
    .filter((project) => {
      const matchesCategory =
        state.category === "All" || project.language === state.category;
      const matchesTopic =
        !state.topic ||
        state.topic === "All" ||
        (project.topics || []).includes(state.topic);
      const matchesQuery =
        normalizedQuery === "" ||
        [
          project.name,
          project.full_name,
          project.owner,
          project.language,
          project.description,
          ...(project.topics || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesTopic && matchesQuery;
    })
    .sort((first, second) => {
      if (state.sortBy === "title") {
        return first.name.localeCompare(second.name);
      }

      if (state.sortBy === "updated_at") {
        return new Date(second.updated_at) - new Date(first.updated_at);
      }

      return second[state.sortBy] - first[state.sortBy];
    });
}

function createMetric(label, value) {
  return `
    <div class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `;
}

function createStatusPill(label, tone = "muted") {
  return `<span class="status-pill status-pill--${tone}">${label}</span>`;
}

function buildSummaryText(filteredProjects) {
  if (filteredProjects.length === 0) {
    return "目前沒有符合條件的項目，建議放寬關鍵字或 topic 條件。";
  }

  const topProject = filteredProjects[0];
  if (state.viewMode === "compact") {
    return `簡單檢視聚焦名稱、描述、語言、星星數與更新時間，方便快速瀏覽 ${topProject.name}。`;
  }

  return `目前共整理出 ${filteredProjects.length} 個項目，建議優先查看 ${topProject.name}。`;
}

function renderProjects() {
  const filteredProjects = getFilteredProjects();

  resultsCount.textContent = `共 ${filteredProjects.length} 筆結果`;
  resultsSummary.textContent = buildSummaryText(filteredProjects);
  projectGrid.classList.toggle("is-list", state.viewMode === "list");
  projectGrid.classList.toggle("is-compact", state.viewMode === "compact");
  viewMenuItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === state.viewMode);
  });
  projectGrid.innerHTML = filteredProjects
    .map(
      (project, index) => `
        <article class="card is-entering" style="animation-delay: ${index * 70}ms">
          <div class="card__rank">Top ${index + 1}</div>
          <div class="card__top">
            <div>
              <h3 class="card__title">${project.name}</h3>
              <p class="card__subtitle">${highlightText(project.full_name)}</p>
            </div>
            <span class="category-tag">${project.language}</span>
          </div>
          <div class="metrics">
            ${createMetric("Stars", project.stars)}
            ${createMetric("Forks", project.forks)}
            ${createMetric("Watching", project.watchers)}
          </div>
          <p class="card__readme">${highlightText(project.description || "暫無介紹內容。")}</p>
          <div class="status-row">
            ${createStatusPill(project.archived ? "Archived" : "Active", project.archived ? "muted" : "good")}
            ${createStatusPill(project.visibility || "public", "muted")}
            ${createStatusPill(project.license || "No license", "muted")}
          </div>
          <div class="card__meta">
            <span>Owner: ${project.owner || "Unknown"}</span>
            <span>Issues: ${project.open_issues}</span>
            <span>Updated: ${formatDate(project.updated_at)}</span>
          </div>
          <div class="topics">
            ${(project.topics || [])
              .slice(0, 6)
              .map((topic) => `<span class="topic">${highlightText(topic)}</span>`)
              .join("")}
          </div>
          <div class="card__links">
            <a class="card__link" href="${project.html_url}" target="_blank" rel="noreferrer">GitHub Repo</a>
            ${
              project.homepage
                ? `<a class="card__link" href="${project.homepage}" target="_blank" rel="noreferrer">Homepage</a>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  emptyState.classList.toggle("hidden", filteredProjects.length > 0);
  projectGrid.classList.toggle("hidden", filteredProjects.length === 0);
}

async function loadProjects() {
  resultsCount.textContent = "資料載入中...";

  try {
    const response = await fetch("/api/tools");
    const data = await response.json();
    state.projects = data.items || [];
    state.topic = "All";
    renderHeroStats();
    renderCategoryChips();
    renderTopicChips();
    renderProjects();
  } catch (error) {
    resultsCount.textContent = "資料載入失敗";
    projectGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `
      <h3>無法連接資料庫</h3>
      <p>請確認本機伺服器已透過 start-server.bat 啟動。</p>
    `;
  }
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderProjects();
});

sortSelect.addEventListener("change", (event) => {
  state.sortBy = event.target.value;
  renderProjects();
});

viewSwitch.addEventListener("click", () => {
  const isHidden = viewMenu.classList.contains("hidden");
  viewMenu.classList.toggle("hidden", !isHidden);
  viewSwitch.setAttribute("aria-expanded", String(isHidden));
});

viewMenuItems.forEach((item) => {
  item.addEventListener("click", () => {
    state.viewMode = item.dataset.view;
    viewMenu.classList.add("hidden");
    viewSwitch.setAttribute("aria-expanded", "false");
    projectGrid.classList.add("is-switching");
    setTimeout(() => {
      renderProjects();
      projectGrid.classList.remove("is-switching");
    }, 120);
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".view-switch-wrap")) {
    viewMenu.classList.add("hidden");
    viewSwitch.setAttribute("aria-expanded", "false");
  }
});

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("gafy-theme") || "light");
loadProjects();
