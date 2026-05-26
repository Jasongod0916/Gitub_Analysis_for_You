const collectionState = {
  tools: [],
  collections: [],
  selectedId: null,
};

const themeToggle = document.querySelector("#themeToggle");
const themeToggleLabel = document.querySelector("#themeToggleLabel");
const collectionGrid = document.querySelector("#collectionGrid");
const collectionOverviewEmpty = document.querySelector("#collectionOverviewEmpty");
const collectionOverviewSummary = document.querySelector("#collectionOverviewSummary");
const collectionTotalPaths = document.querySelector("#collectionTotalPaths");
const collectionTotalRepos = document.querySelector("#collectionTotalRepos");
const collectionHotPath = document.querySelector("#collectionHotPath");
const collectionDetailPanel = document.querySelector("#collectionDetailPanel");
const collectionDetailTitle = document.querySelector("#collectionDetailTitle");
const collectionDetailDescription = document.querySelector("#collectionDetailDescription");
const collectionAudienceLabel = document.querySelector("#collectionAudienceLabel");
const collectionRepoCountLabel = document.querySelector("#collectionRepoCountLabel");
const collectionDetailState = document.querySelector("#collectionDetailState");
const collectionDetailContent = document.querySelector("#collectionDetailContent");
const collectionRepoGrid = document.querySelector("#collectionRepoGrid");

const COLLECTION_DEFINITIONS = [
  {
    id: "frontend-web-ui",
    title: "前端與 Web UI",
    description: "適合先從 UI、互動、dashboard 與網站呈現方式切入，快速建立前端產品感。",
    audienceLabel: "適合拆 UI、看介面組成與前端實作的人",
    tags: ["React", "Dashboard", "UI"],
    languages: ["javascript", "typescript", "html", "css"],
    topics: ["react", "nextjs", "vue", "frontend", "dashboard", "ui", "web", "website", "homepage", "tailwindcss"],
    keywords: ["react", "next", "dashboard", "frontend", "ui", "component", "website", "landing page", "tailwind"],
  },
  {
    id: "python-automation",
    title: "Python 與自動化",
    description: "用 Python 腳本、工具與自動化專案建立實作感，適合想邊學邊做的人。",
    audienceLabel: "適合想用 Python 快速做工具與自動化的人",
    tags: ["Python", "Automation", "Scripts"],
    languages: ["python"],
    topics: ["python", "automation", "script", "scraping", "bot", "crawler", "tool"],
    keywords: ["python", "automation", "script", "scrape", "crawler", "bot", "workflow", "productivity"],
  },
  {
    id: "ai-llm-agent",
    title: "AI / LLM / Agent",
    description: "聚焦在 LLM、agent 與 AI workflow，適合想理解新一代 AI 應用組裝方式的人。",
    audienceLabel: "適合想快速看懂 agent、RAG 與 LLM 應用的人",
    tags: ["LLM", "Agent", "RAG"],
    languages: ["python", "typescript", "javascript"],
    topics: ["ai", "llm", "agent", "rag", "openai", "langchain", "chatbot", "transformers"],
    keywords: ["llm", "agent", "rag", "openai", "langchain", "prompt", "chatbot", "transformer", "embedding"],
  },
  {
    id: "data-science-ml",
    title: "資料科學與機器學習",
    description: "從資料分析、模型實作到深度學習案例，整理成較容易進入的學習順序。",
    audienceLabel: "適合想從資料處理一路看到模型與實作的人",
    tags: ["Machine Learning", "Data Science", "Deep Learning"],
    languages: ["python", "jupyter notebook"],
    topics: ["machine-learning", "deep-learning", "data-science", "tensorflow", "pytorch", "nlp", "computer-vision"],
    keywords: ["machine learning", "deep learning", "data science", "tensorflow", "pytorch", "dataset", "model"],
  },
  {
    id: "developer-tools-cli",
    title: "開發工具與 CLI",
    description: "把工具型、終端機與開發流程相關 repo 整理成一條偏實務的學習路線。",
    audienceLabel: "適合想提升開發效率、理解工具設計的人",
    tags: ["CLI", "Dev Tools", "Productivity"],
    languages: ["go", "rust", "python", "shell", "typescript", "javascript"],
    topics: ["cli", "terminal", "tool", "developer-tools", "productivity", "shell"],
    keywords: ["cli", "terminal", "shell", "developer tool", "tooling", "productivity", "workflow"],
  },
  {
    id: "open-source-starter",
    title: "開源入門與教學型專案",
    description: "挑出比較容易閱讀、帶有教學意圖或適合初學者的 repo，降低開源入門門檻。",
    audienceLabel: "適合剛開始看開源 repo、不知道先讀哪個的人",
    tags: ["Beginner", "Tutorial", "Docs"],
    languages: ["python", "javascript", "typescript"],
    topics: ["tutorial", "beginner", "docs", "guide", "education", "learning"],
    keywords: ["tutorial", "beginner", "guide", "learn", "teaching", "documentation", "introduction"],
  },
  {
    id: "curated-resources",
    title: "Awesome / Curated Resources",
    description: "如果你還不確定要先學哪個單點專案，先看整理型資源會更快找到方向。",
    audienceLabel: "適合先看資源清單、再決定深挖方向的人",
    tags: ["Awesome", "Resources", "Curated"],
    languages: ["markdown"],
    topics: ["awesome", "resources", "list", "curated", "collection"],
    keywords: ["awesome", "resource", "resources", "list", "collection", "curated", "handbook"],
  },
  {
    id: "build-your-own",
    title: "Build-your-own / Learning-by-building",
    description: "特別適合用『自己做一遍』的方式學習，從模仿、重建到理解底層思路。",
    audienceLabel: "適合喜歡邊做邊學、想靠重建練功的人",
    tags: ["Build Your Own", "From Scratch", "Practice"],
    languages: ["python", "javascript", "typescript", "go", "rust"],
    topics: ["build-your-own", "from-scratch", "practice", "clone", "recreate"],
    keywords: ["build your own", "from scratch", "recreate", "clone", "implementation", "hands-on"],
  },
].map((definition) => ({
  ...definition,
  normalizedLanguages: definition.languages.map((item) => normalizeText(item)),
  normalizedTopics: definition.topics.map((item) => normalizeText(item)),
  normalizedKeywords: definition.keywords.map((item) => normalizeText(item)),
}));

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
  themeToggleLabel.textContent = nextTheme === "dark" ? "切換淺色" : "切換深色";
  localStorage.setItem("gafy-theme", nextTheme);
  setTag("theme", nextTheme);
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeText(value) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function toTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function decorateTools(tools) {
  return tools.map((tool) => {
    const normalizedTopics = unique((tool.topics || []).map((topic) => normalizeText(topic)));
    const normalizedLanguage = normalizeText(tool.language || "unknown");
    const normalizedText = normalizeText(
      [tool.name, tool.full_name, tool.owner, tool.description, tool.language, ...(tool.topics || [])].join(" ")
    );

    return {
      ...tool,
      normalizedTopics,
      normalizedLanguage,
      normalizedText,
      normalizedTokens: unique(tokenizeText(normalizedText)),
      updatedTimestamp: toTimestamp(tool.updated_at),
    };
  });
}

function computeMatchScore(tool, definition) {
  let score = 0;

  if (definition.normalizedLanguages.includes(tool.normalizedLanguage)) {
    score += 10;
  }

  definition.normalizedTopics.forEach((topic) => {
    if (tool.normalizedTopics.includes(topic)) {
      score += 12;
    } else if (tool.normalizedText.includes(topic)) {
      score += 4;
    }
  });

  definition.normalizedKeywords.forEach((keyword) => {
    if (tool.normalizedText.includes(keyword)) {
      score += 5;
    }
  });

  if (definition.id === "build-your-own" && tool.normalizedText.includes("build your own")) {
    score += 18;
  }

  if (definition.id === "curated-resources" && tool.normalizedText.includes("awesome")) {
    score += 14;
  }

  return score;
}

function assignRole(tool, index) {
  const text = tool.normalizedText;
  const topics = tool.normalizedTopics;

  if (topics.includes("awesome") || text.includes("awesome") || text.includes("resources") || text.includes("list")) {
    return "資源整理";
  }

  if (text.includes("tutorial") || text.includes("guide") || text.includes("beginner")) {
    return "入門";
  }

  if (
    tool.homepage ||
    text.includes("example") ||
    text.includes("template") ||
    text.includes("demo") ||
    text.includes("starter")
  ) {
    return "範例";
  }

  if (index <= 2) {
    return "核心案例";
  }

  return "進階參考";
}

function buildReason(tool, definition, matchScore, role) {
  const sharedTopics = definition.normalizedTopics
    .filter((topic) => tool.normalizedTopics.includes(topic))
    .slice(0, 2)
    .map((topic) => topic.replaceAll("-", " "));

  const reasonParts = [];

  if (sharedTopics.length > 0) {
    reasonParts.push(`命中 ${sharedTopics.join(" / ")} 這條學習主線`);
  }

  if ((tool.language || "").trim()) {
    reasonParts.push(`主要語言是 ${tool.language}`);
  }

  if (tool.homepage) {
    reasonParts.push("可直接延伸看首頁或 demo");
  } else if ((tool.description || "").length > 80) {
    reasonParts.push("描述內容較完整，較容易快速理解定位");
  } else if ((tool.stars || 0) >= 10000) {
    reasonParts.push("stars 高，適合作為代表案例");
  }

  if (reasonParts.length === 0) {
    reasonParts.push(`這個 repo 在「${definition.title}」的規則匹配度高，適合作為 ${role} 來看`);
  }

  return `${reasonParts.slice(0, 2).join("，")}。`;
}

function buildCollections(tools) {
  const buckets = new Map(COLLECTION_DEFINITIONS.map((definition) => [definition.id, []]));

  tools.forEach((tool) => {
    const scoredMatches = COLLECTION_DEFINITIONS.map((definition) => ({
      definition,
      score: computeMatchScore(tool, definition),
    })).sort((first, second) => second.score - first.score);

    const best = scoredMatches[0];
    if (!best || best.score <= 0) return;
    buckets.get(best.definition.id).push({ tool, matchScore: best.score });
  });

  return COLLECTION_DEFINITIONS.map((definition) => {
    const matches = (buckets.get(definition.id) || []).sort(
      (first, second) =>
        second.matchScore - first.matchScore ||
        (second.tool.stars || 0) - (first.tool.stars || 0) ||
        second.tool.updatedTimestamp - first.tool.updatedTimestamp
    );

    if (matches.length < 4) return null;

    const items = matches.slice(0, 12).map(({ tool, matchScore }, index) => {
      const collectionRole = assignRole(tool, index);

      return {
        id: tool.id,
        name: tool.name,
        full_name: tool.full_name,
        owner: tool.owner,
        description: tool.description,
        html_url: tool.html_url,
        homepage: tool.homepage,
        stars: tool.stars,
        forks: tool.forks,
        language: tool.language || "Unknown",
        updated_at: tool.updated_at,
        topics: tool.topics || [],
        collectionRole,
        matchScore,
        reason: buildReason(tool, definition, matchScore, collectionRole),
      };
    });

    const totalStars = matches.reduce((sum, item) => sum + (item.tool.stars || 0), 0);

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      audienceLabel: definition.audienceLabel,
      tags: definition.tags,
      repoCount: matches.length,
      featuredRepo: items[0]?.name || "未命名 repo",
      totalStars,
      items,
    };
  }).filter(Boolean);
}

function renderHeroStats() {
  const hottestCollection = [...collectionState.collections].sort(
    (first, second) => second.repoCount - first.repoCount || second.totalStars - first.totalStars
  )[0];

  collectionTotalPaths.textContent = formatNumber(collectionState.collections.length);
  collectionTotalRepos.textContent = formatNumber(collectionState.tools.length);
  collectionHotPath.textContent = hottestCollection?.title || "--";
  collectionOverviewSummary.textContent = `目前從 ${formatNumber(collectionState.tools.length)} 筆 repo 中整理出 ${formatNumber(
    collectionState.collections.length
  )} 條學習路徑，先選方向，再往下展開代表專案。`;
}

function renderCollections() {
  if (collectionState.collections.length === 0) {
    collectionGrid.innerHTML = "";
    collectionOverviewEmpty.classList.remove("hidden");
    return;
  }

  collectionOverviewEmpty.classList.add("hidden");
  collectionGrid.innerHTML = collectionState.collections
    .map((collection) => {
      const isActive = collectionState.selectedId === collection.id;
      return `
        <button class="collection-card${isActive ? " is-active" : ""}" data-collection-id="${collection.id}" type="button">
          <div class="collection-card__top">
            <span class="collection-card__eyebrow">Learning Path</span>
            <span class="collection-card__count">${formatNumber(collection.repoCount)} repos</span>
          </div>
          <div>
            <h3>${escapeHtml(collection.title)}</h3>
            <p>${escapeHtml(collection.description)}</p>
          </div>
          <p class="collection-card__audience">${escapeHtml(collection.audienceLabel)}</p>
          <div class="collection-card__featured">
            <span>代表 repo</span>
            <strong>${escapeHtml(collection.featuredRepo)}</strong>
          </div>
          <div class="collection-card__tags">
            ${collection.tags.map((tag) => `<span class="collection-chip">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </button>
      `;
    })
    .join("");

  collectionGrid.querySelectorAll("[data-collection-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectCollection(button.dataset.collectionId);
    });
  });
}

function renderDetail() {
  const collection = collectionState.collections.find((item) => item.id === collectionState.selectedId);

  if (!collection) {
    collectionDetailTitle.textContent = "點一條路徑開始看";
    collectionDetailDescription.textContent =
      "先從上方選一張 collection 卡，下面就會展開代表 repo、角色標籤與推薦理由。";
    collectionAudienceLabel.textContent = "學習導向";
    collectionRepoCountLabel.textContent = "--";
    collectionDetailState.classList.remove("hidden");
    collectionDetailContent.classList.add("hidden");
    collectionRepoGrid.innerHTML = "";
    return;
  }

  collectionDetailTitle.textContent = collection.title;
  collectionDetailDescription.textContent = collection.description;
  collectionAudienceLabel.textContent = collection.audienceLabel;
  collectionRepoCountLabel.textContent = `${formatNumber(collection.repoCount)} 個關聯 repo`;
  collectionDetailState.classList.add("hidden");
  collectionDetailContent.classList.remove("hidden");

  collectionRepoGrid.innerHTML = collection.items
    .map((item) => {
      const topics = (item.topics || []).slice(0, 4);
      return `
        <article class="collection-repo-card">
          <div class="collection-repo-card__top">
            <div>
              <h4>${escapeHtml(item.name)}</h4>
              <p class="collection-repo-card__owner">${escapeHtml(item.full_name || item.owner || "Unknown")}</p>
            </div>
            <span class="collection-role">${escapeHtml(item.collectionRole)}</span>
          </div>
          <p class="collection-repo-card__reason">${escapeHtml(item.reason)}</p>
          <div class="collection-repo-card__meta">
            <span>${escapeHtml(item.language || "Unknown")}</span>
            <span>${formatNumber(item.stars)} stars</span>
            <span>更新於 ${formatDate(item.updated_at)}</span>
          </div>
          <div class="collection-repo-card__topics">
            ${topics.map((topic) => `<span class="collection-chip">${escapeHtml(topic)}</span>`).join("")}
          </div>
          <div class="collection-repo-card__actions">
            <a class="card__link" href="${escapeHtml(item.html_url)}" target="_blank" rel="noreferrer">Open GitHub Repo</a>
            ${
              item.homepage
                ? `<a class="card__link" href="${escapeHtml(item.homepage)}" target="_blank" rel="noreferrer">Homepage</a>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function selectCollection(collectionId) {
  collectionState.selectedId = collectionId;
  renderCollections();
  renderDetail();

  const selected = collectionState.collections.find((collection) => collection.id === collectionId);
  if (selected) {
    setTag("collection_selected", selected.id);
    trackEvent("collection_selected");
  }

  collectionDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadCollections() {
  try {
    const response = await fetch("/api/tools");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    collectionState.tools = decorateTools(data.items || []);
    collectionState.collections = buildCollections(collectionState.tools);

    renderHeroStats();
    renderCollections();
    renderDetail();
    setTag("page_type", "collection-map");
    setTag("collection_count", String(collectionState.collections.length));
    setTag("collection_has_data", collectionState.collections.length > 0 ? "true" : "false");
    trackEvent("collection_map_loaded");
  } catch (error) {
    collectionState.tools = [];
    collectionState.collections = [];
    renderHeroStats();
    renderCollections();
    collectionDetailTitle.textContent = "目前無法整理學習地圖";
    collectionDetailDescription.textContent = "請確認本機伺服器與資料庫可正常提供 /api/tools。";
    collectionAudienceLabel.textContent = "資料載入失敗";
    collectionRepoCountLabel.textContent = "--";
    collectionDetailState.classList.remove("hidden");
    collectionDetailContent.classList.add("hidden");
    collectionDetailState.innerHTML = `
      <div class="collection-empty">
        <strong>讀取資料失敗</strong>
        <p>目前無法從 <code>/api/tools</code> 取得資料，因此還不能產生學習路徑。</p>
      </div>
    `;
  }
}

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  trackEvent("theme_toggled");
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("gafy-theme") || "light");
loadCollections();
