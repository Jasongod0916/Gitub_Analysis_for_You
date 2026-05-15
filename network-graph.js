const graphState = {
  tools: [],
  topicFrequency: new Map(),
  toolLookup: new Map(),
  rootTool: null,
  selectedTool: null,
  visibleNodes: [],
  visibleEdges: [],
  visibleRange: 12,
  colorByLanguage: false,
  camera: {
    scale: 1,
    translateX: 0,
    translateY: 0,
    minScale: 0.48,
    maxScale: 2.8,
  },
  canvasSize: {
    width: 960,
    height: 720,
  },
  isDragging: false,
  dragPointerId: null,
  dragStart: null,
};

const SEARCH_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "your",
  "that",
  "this",
  "open",
  "source",
  "project",
  "projects",
  "tool",
  "tools",
  "repo",
  "repository",
  "github",
  "using",
  "built",
  "list",
  "lists",
  "guide",
]);

const LANGUAGE_COLORS = [
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

const STAR_COLOR_STEPS = [
  "hsl(172 18% 88%)",
  "hsl(174 28% 69%)",
  "hsl(176 44% 49%)",
  "hsl(176 66% 31%)",
  "hsl(176 82% 16%)",
];

const STAR_STROKE_STEPS = [
  "hsla(176, 18%, 74%, 0.58)",
  "hsla(176, 28%, 54%, 0.68)",
  "hsla(176, 44%, 38%, 0.78)",
  "hsla(176, 66%, 22%, 0.88)",
  "hsla(176, 82%, 12%, 0.96)",
];

const graphTotalTools = document.querySelector("#graphTotalTools");
const graphVisibleNodes = document.querySelector("#graphVisibleNodes");
const graphVisibleEdges = document.querySelector("#graphVisibleEdges");
const graphSearchForm = document.querySelector("#graphSearchForm");
const graphSearchInput = document.querySelector("#graphSearchInput");
const projectSuggestions = document.querySelector("#projectSuggestions");
const graphSearchHint = document.querySelector("#graphSearchHint");
const graphNodeRange = document.querySelector("#graphNodeRange");
const graphNodeRangeValue = document.querySelector("#graphNodeRangeValue");
const graphFocusTopics = document.querySelector("#graphFocusTopics");
const graphRelationCount = document.querySelector("#graphRelationCount");
const graphRelationList = document.querySelector("#graphRelationList");
const graphHeadline = document.querySelector("#graphHeadline");
const graphSummary = document.querySelector("#graphSummary");
const graphStage = document.querySelector("#graphStage");
const graphCanvas = document.querySelector("#graphCanvas");
const graphNodeMenu = document.querySelector("#graphNodeMenu");
const graphLoading = document.querySelector("#graphLoading");
const graphDetail = document.querySelector("#graphDetail");
const graphZoomIn = document.querySelector("#graphZoomIn");
const graphZoomOut = document.querySelector("#graphZoomOut");
const graphResetView = document.querySelector("#graphResetView");
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
  themeToggleLabel.textContent = nextTheme === "dark" ? "淺色模式" : "深色模式";
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
  return new Intl.NumberFormat("zh-TW").format(value || 0);
}

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-TW");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function tokenizeText(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 || /[\u4e00-\u9fff]/u.test(token))
    .filter((token) => !SEARCH_STOPWORDS.has(token));
}

function titleCaseLanguage(value) {
  return value && value !== "Unknown" ? value : "Unknown";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getLanguageColor(language) {
  const normalized = titleCaseLanguage(language);
  let total = 0;
  for (const char of normalized) total += char.charCodeAt(0);
  return LANGUAGE_COLORS[total % LANGUAGE_COLORS.length];
}

function getStarsTier(stars) {
  const visibleStars = graphState.visibleNodes
    .filter((node) => !node.isRoot)
    .map((node) => node.tool.stars || 0)
    .sort((first, second) => first - second);

  if (visibleStars.length <= 1) return 2;

  const rank = visibleStars.filter((value) => value <= (stars || 0)).length - 1;
  const percentile = clamp(rank / Math.max(visibleStars.length - 1, 1), 0, 1);
  return Math.min(
    STAR_COLOR_STEPS.length - 1,
    Math.floor(percentile * STAR_COLOR_STEPS.length)
  );
}

function getStarsColor(stars) {
  return STAR_COLOR_STEPS[getStarsTier(stars)];
}

function getNodeColor(tool, isRoot) {
  if (isRoot) return "hsl(176 55% 24%)";
  if (graphState.colorByLanguage) return getLanguageColor(tool.language);
  return getStarsColor(tool.stars);
}

function getVisibleLanguageLegend() {
  const counts = new Map();

  graphState.visibleNodes.forEach((node) => {
    const language = titleCaseLanguage(node.tool.language);
    counts.set(language, (counts.get(language) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 8)
    .map(([language, count]) => ({
      language,
      count,
      color: getLanguageColor(language),
    }));
}

function decorateTools(items) {
  const topicFrequency = new Map();

  const tools = items.map((tool) => {
    const topics = unique((tool.topics || []).map((topic) => normalizeText(topic)));
    topics.forEach((topic) => {
      topicFrequency.set(topic, (topicFrequency.get(topic) || 0) + 1);
    });

    return {
      ...tool,
      normalizedName: normalizeText(tool.name),
      normalizedFullName: normalizeText(tool.full_name),
      normalizedOwner: normalizeText(tool.owner),
      normalizedLanguage: normalizeText(tool.language || "Unknown"),
      normalizedTopics: topics,
      descriptionTokens: unique(tokenizeText(tool.description)).slice(0, 16),
      searchText: normalizeText(
        [
          tool.name,
          tool.full_name,
          tool.owner,
          tool.language,
          tool.description,
          ...(tool.topics || []),
        ].join(" ")
      ),
      sizeScore: Math.log10((tool.stars || 0) + 10),
    };
  });

  graphState.topicFrequency = topicFrequency;
  graphState.toolLookup = new Map(tools.map((tool) => [tool.id, tool]));

  return tools;
}

function getSharedTopics(first, second) {
  return first.normalizedTopics.filter((topic) => second.normalizedTopics.includes(topic));
}

function getSharedDescriptionTokens(first, second) {
  return first.descriptionTokens.filter((token) => second.descriptionTokens.includes(token));
}

function getTopicWeight(topic) {
  const frequency = graphState.topicFrequency.get(topic) || 1;
  const rarity = Math.log2((graphState.tools.length + 2) / frequency);
  return clamp(rarity, 0.35, 4.2);
}

function buildReasons(first, second, sharedTopics, sharedTokens) {
  const reasons = [];

  if (sharedTopics.length) {
    const topicNames = sharedTopics
      .slice()
      .sort((a, b) => getTopicWeight(b) - getTopicWeight(a))
      .slice(0, 3)
      .join("、");
    reasons.push(`共享主題：${topicNames}`);
  }

  if (
    first.normalizedLanguage &&
    first.normalizedLanguage === second.normalizedLanguage &&
    first.normalizedLanguage !== "unknown"
  ) {
    reasons.push(`同語言：${titleCaseLanguage(first.language)}`);
  }

  if (first.normalizedOwner && first.normalizedOwner === second.normalizedOwner) {
    reasons.push(`同 owner：${first.owner}`);
  }

  if (sharedTokens.length) {
    reasons.push(`描述交集：${sharedTokens.slice(0, 3).join("、")}`);
  }

  return reasons;
}

function getSimilarity(first, second) {
  const sharedTopics = getSharedTopics(first, second);
  const sharedTokens = getSharedDescriptionTokens(first, second);

  let score = 0;
  score += sharedTopics.reduce((sum, topic) => sum + getTopicWeight(topic) * 2.2, 0);

  if (
    first.normalizedLanguage &&
    first.normalizedLanguage === second.normalizedLanguage &&
    first.normalizedLanguage !== "unknown"
  ) {
    score += 1.7;
  }

  if (first.normalizedOwner && first.normalizedOwner === second.normalizedOwner) {
    score += 2.4;
  }

  score += Math.min(sharedTokens.length, 4) * 0.55;

  if (score <= 0) {
    return {
      score: 0,
      sharedTopics,
      sharedTokens,
      reasons: [],
    };
  }

  return {
    score,
    sharedTopics,
    sharedTokens,
    reasons: buildReasons(first, second, sharedTopics, sharedTokens),
  };
}

function getFallbackNeighbors(rootTool, scoredTools, targetCount) {
  const chosenIds = new Set(scoredTools.map((item) => item.tool.id));

  const sameLanguage = graphState.tools
    .filter(
      (tool) =>
        tool.id !== rootTool.id &&
        !chosenIds.has(tool.id) &&
        rootTool.normalizedLanguage !== "unknown" &&
        tool.normalizedLanguage === rootTool.normalizedLanguage
    )
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));

  const sharedOwner = graphState.tools
    .filter(
      (tool) =>
        tool.id !== rootTool.id &&
        !chosenIds.has(tool.id) &&
        tool.normalizedOwner &&
        tool.normalizedOwner === rootTool.normalizedOwner
    )
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));

  const popular = graphState.tools
    .filter((tool) => tool.id !== rootTool.id && !chosenIds.has(tool.id))
    .sort((a, b) => (b.stars || 0) - (a.stars || 0));

  const fallbackPool = [...sameLanguage, ...sharedOwner, ...popular];
  const fallback = [];

  for (const tool of fallbackPool) {
    if (fallback.length >= targetCount) break;
    if (chosenIds.has(tool.id)) continue;

    chosenIds.add(tool.id);
    const relation = getSimilarity(rootTool, tool);
    fallback.push({
      tool,
      score: relation.score || 0.8,
      reasons: relation.reasons.length ? relation.reasons : ["熱門鄰近節點"],
      sharedTopics: relation.sharedTopics,
    });
  }

  return fallback;
}

function buildNeighborhood(rootTool) {
  const scored = graphState.tools
    .filter((tool) => tool.id !== rootTool.id)
    .map((tool) => {
      const relation = getSimilarity(rootTool, tool);
      return {
        tool,
        score: relation.score,
        reasons: relation.reasons,
        sharedTopics: relation.sharedTopics,
      };
    })
    .filter((item) => item.score > 0.4)
    .sort((a, b) => b.score - a.score || (b.tool.stars || 0) - (a.tool.stars || 0));

  const primary = scored.slice(0, graphState.visibleRange);
  const filler = getFallbackNeighbors(
    rootTool,
    primary,
    Math.max(0, graphState.visibleRange - primary.length)
  );
  const neighbors = [...primary, ...filler].slice(0, graphState.visibleRange);

  const nodes = [
    {
      tool: rootTool,
      score: 0,
      reasons: [],
      isRoot: true,
    },
    ...neighbors.map((item) => ({ ...item, isRoot: false })),
  ];

  const selectedTools = nodes.map((node) => node.tool);
  const edges = [];

  neighbors.forEach((neighbor) => {
    edges.push({
      source: rootTool.id,
      target: neighbor.tool.id,
      weight: neighbor.score,
      isPrimary: true,
    });
  });

  const secondaryEdges = [];
  for (let index = 0; index < selectedTools.length; index += 1) {
    for (let inner = index + 1; inner < selectedTools.length; inner += 1) {
      const first = selectedTools[index];
      const second = selectedTools[inner];
      if (first.id === rootTool.id || second.id === rootTool.id) continue;

      const relation = getSimilarity(first, second);
      if (relation.score < 2.4) continue;

      secondaryEdges.push({
        source: first.id,
        target: second.id,
        weight: relation.score,
        isPrimary: false,
      });
    }
  }

  secondaryEdges
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.max(18, Math.floor(neighbors.length * 1.1)))
    .forEach((edge) => edges.push(edge));

  return { nodes, edges };
}

function layoutGraph(nodes, edges, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const positions = new Map();
  const damping = 0.9;
  const padding = 86;
  const radiusBase = Math.min(width, height) * 0.36;

  nodes.forEach((node, index) => {
    if (node.isRoot) {
      positions.set(node.tool.id, {
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        radius: 50,
      });
      return;
    }

    const angle = (Math.PI * 2 * (index - 1)) / Math.max(1, nodes.length - 1);
    const randomOffset = (index % 5) * 26;
    positions.set(node.tool.id, {
      x: centerX + Math.cos(angle) * (radiusBase + randomOffset),
      y: centerY + Math.sin(angle) * (radiusBase + randomOffset),
      vx: 0,
      vy: 0,
      radius: 15 + clamp(node.tool.sizeScore * 3.4, 0, 23),
    });
  });

  for (let step = 0; step < 320; step += 1) {
    for (let index = 0; index < nodes.length; index += 1) {
      for (let inner = index + 1; inner < nodes.length; inner += 1) {
        const first = positions.get(nodes[index].tool.id);
        const second = positions.get(nodes[inner].tool.id);
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distanceSq = Math.max(dx * dx + dy * dy, 0.01);
        const distance = Math.sqrt(distanceSq);
        const minDistance = first.radius + second.radius + 54;
        const force = (minDistance * minDistance * 0.042) / distanceSq;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (!nodes[index].isRoot) {
          first.vx -= fx;
          first.vy -= fy;
        }
        if (!nodes[inner].isRoot) {
          second.vx += fx;
          second.vy += fy;
        }
      }
    }

    edges.forEach((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const ideal = edge.isPrimary ? 190 - edge.weight * 9 : 152 - edge.weight * 6;
      const spring = (distance - clamp(ideal, 104, 228)) * 0.006;
      const fx = (dx / distance) * spring;
      const fy = (dy / distance) * spring;

      if (edge.source !== graphState.rootTool.id) {
        source.vx += fx;
        source.vy += fy;
      }

      if (edge.target !== graphState.rootTool.id) {
        target.vx -= fx;
        target.vy -= fy;
      }
    });

    nodes.forEach((node) => {
      const point = positions.get(node.tool.id);

      if (node.isRoot) {
        point.x = centerX;
        point.y = centerY;
        point.vx = 0;
        point.vy = 0;
        return;
      }

      point.vx += (centerX - point.x) * 0.00055;
      point.vy += (centerY - point.y) * 0.00055;
      point.vx *= damping;
      point.vy *= damping;
      point.x = clamp(point.x + point.vx, padding, width - padding);
      point.y = clamp(point.y + point.vy, padding, height - padding);
    });
  }

  return positions;
}

function getGraphBounds(positions) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  positions.forEach((point) => {
    minX = Math.min(minX, point.x - point.radius - 20);
    minY = Math.min(minY, point.y - point.radius - 28);
    maxX = Math.max(maxX, point.x + point.radius + 20);
    maxY = Math.max(maxY, point.y + point.radius + 32);
  });

  return { minX, minY, maxX, maxY };
}

function resetCamera(bounds) {
  const width = graphState.canvasSize.width;
  const height = graphState.canvasSize.height;
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = clamp(Math.min(width / boundsWidth, height / boundsHeight) * 1.65, 0.98, 1.92);
  const graphCenterX = (bounds.minX + bounds.maxX) / 2;
  const graphCenterY = (bounds.minY + bounds.maxY) / 2;

  graphState.camera.scale = scale;
  graphState.camera.translateX = width / 2 - graphCenterX * scale;
  graphState.camera.translateY = height / 2 - graphCenterY * scale;
}

function applyViewportTransform() {
  const viewport = graphCanvas.querySelector("#graphViewport");
  if (!viewport) return;

  viewport.setAttribute(
    "transform",
    `translate(${graphState.camera.translateX.toFixed(2)} ${graphState.camera.translateY.toFixed(
      2
    )}) scale(${graphState.camera.scale.toFixed(4)})`
  );
}

function getSvgPointFromClient(clientX, clientY) {
  const rect = graphCanvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * graphState.canvasSize.width;
  const y = ((clientY - rect.top) / rect.height) * graphState.canvasSize.height;
  return { x, y };
}

function getTopFocusTopics(rootTool, nodes) {
  const counts = new Map();
  nodes.forEach((node) => {
    if (node.isRoot) return;
    node.sharedTopics?.forEach((topic) => {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    });
  });

  const rootTopics = rootTool.normalizedTopics.slice(0, 4);
  const sharedTopTopics = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || getTopicWeight(b[0]) - getTopicWeight(a[0]))
    .slice(0, 4)
    .map(([topic]) => topic);

  return unique([...sharedTopTopics, ...rootTopics]).slice(0, 6);
}

function renderStats() {
  graphTotalTools.textContent = formatNumber(graphState.tools.length);
  graphVisibleNodes.textContent = formatNumber(graphState.visibleNodes.length);
  graphVisibleEdges.textContent = formatNumber(graphState.visibleEdges.length);
}

function renderFocusTopics() {
  const topics = getTopFocusTopics(graphState.rootTool, graphState.visibleNodes);

  graphFocusTopics.innerHTML = topics.length
    ? topics.map((topic) => `<span class="graph-chip">${escapeHtml(topic)}</span>`).join("")
    : `<span class="graph-chip">目前沒有可用 topic</span>`;
}

function renderRelationList() {
  const neighbors = graphState.visibleNodes.filter((node) => !node.isRoot);
  graphRelationCount.textContent = `${neighbors.length} 個關聯 repo`;

  graphRelationList.innerHTML = neighbors
    .sort((a, b) => b.score - a.score || (b.tool.stars || 0) - (a.tool.stars || 0))
    .map((node, index) => {
      const reason = node.reasons[0] || "描述或主題相近";
      return `
        <button class="graph-list__item" type="button" data-node-id="${node.tool.id}">
          <div>
            <h4>#${index + 1} ${escapeHtml(node.tool.name)}</h4>
            <div class="graph-list__meta-row">
              <span>${escapeHtml(node.tool.owner || "Unknown")}</span>
              <span>${escapeHtml(titleCaseLanguage(node.tool.language))}</span>
              <span>${formatNumber(node.tool.stars)} stars</span>
            </div>
          </div>
          <div class="graph-list__reason">${escapeHtml(reason)}</div>
        </button>
      `;
    })
    .join("");

  graphRelationList.querySelectorAll("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTool = graphState.toolLookup.get(Number(button.dataset.nodeId));
      if (nextTool) {
        focusTool(nextTool, { preserveQuery: true });
      }
    });
  });
}

function getSelectedNode() {
  if (!graphState.selectedTool) return null;
  return graphState.visibleNodes.find((node) => node.tool.id === graphState.selectedTool.id) || null;
}

function updateSelectedNodeStyles() {
  graphCanvas.querySelectorAll("[data-node-id]").forEach((element) => {
    element.classList.toggle(
      "is-selected",
      Number(element.dataset.nodeId) === graphState.selectedTool?.id
    );
  });
}

function hideNodeMenu() {
  graphNodeMenu.classList.add("hidden");
  graphNodeMenu.removeAttribute("data-node-id");
}

function showNodeMenu(tool, event) {
  graphState.selectedTool = tool;
  renderDetail();
  updateSelectedNodeStyles();

  const stageRect = graphStage.getBoundingClientRect();
  const menuWidth = graphNodeMenu.offsetWidth || 112;
  const menuHeight = graphNodeMenu.offsetHeight || 48;
  const left = clamp(event.clientX - stageRect.left + 10, 10, stageRect.width - menuWidth - 10);
  const top = clamp(event.clientY - stageRect.top + 10, 10, stageRect.height - menuHeight - 10);

  graphNodeMenu.style.left = `${left}px`;
  graphNodeMenu.style.top = `${top}px`;
  graphNodeMenu.dataset.nodeId = String(tool.id);
  graphNodeMenu.classList.remove("hidden");
}

function selectTool(tool) {
  graphState.selectedTool = tool;
  hideNodeMenu();
  renderDetail();
  updateSelectedNodeStyles();
  trackEvent("graph_repo_selected");
}

function renderDetail() {
  const tool = graphState.selectedTool || graphState.rootTool;
  const selectedNode = getSelectedNode();
  const highlightTopics =
    selectedNode && !selectedNode.isRoot
      ? selectedNode.sharedTopics?.slice(0, 6) || []
      : getTopFocusTopics(tool, graphState.visibleNodes);
  const languageLegend = getVisibleLanguageLegend();
  const description =
    tool.description ||
    "目前資料庫沒有提供這個 repo 的描述內容，可以先透過 topics、language 與 owner 觀察它的鄰近位置。";

  graphDetail.innerHTML = `
    <p class="results-header__eyebrow">Selected Repo</p>
    <h2>${escapeHtml(tool.name)}</h2>
    <p class="graph-detail__owner">${escapeHtml(tool.full_name)}${tool.homepage ? " · 有首頁" : ""}</p>
    <p class="graph-detail__description">${escapeHtml(description)}</p>

    <div class="graph-detail__metrics">
      <div class="graph-detail__metric">
        <strong>${formatNumber(tool.stars)}</strong>
        <span>Stars</span>
      </div>
      <div class="graph-detail__metric">
        <strong>${formatNumber(tool.forks)}</strong>
        <span>Forks</span>
      </div>
      <div class="graph-detail__metric graph-detail__metric--date">
        <strong>${formatDate(tool.updated_at)}</strong>
        <span>Updated</span>
      </div>
    </div>

    <div class="graph-detail__actions">
      <a class="card__link graph-repo-link" href="${escapeHtml(tool.html_url)}" target="_blank" rel="noreferrer">Open GitHub Repo</a>
      ${
        tool.homepage
          ? `<a class="card__link" href="${escapeHtml(tool.homepage)}" target="_blank" rel="noreferrer">Homepage</a>`
          : ""
      }
    </div>

    <div class="graph-detail__list">
      <div class="graph-detail__card">
        <h3>距離怎麼判斷</h3>
        <p>節點越近，代表 repo 越相似。系統會先看 shared topics，再補上同 language、同 owner 和描述關鍵字交集；共同訊號越多，邊的權重越高，排版時也會被拉得更近。</p>
      </div>
      <div class="graph-detail__card">
        <h3>顏色怎麼判斷</h3>
        <p>預設用同一個青綠色系，會把目前畫面中的 repo 依 stars 分成五段；越熱門越深、外框也越重。開啟語言分色後，其他節點會改依 language 分組顯示。</p>
        <label class="graph-toggle">
          <input id="graphColorModeToggle" type="checkbox" ${graphState.colorByLanguage ? "checked" : ""} />
          <span>依程式語言分色</span>
        </label>
        <div class="graph-language-legend">
          ${
            graphState.colorByLanguage
              ? languageLegend
                  .map(
                    (item) => `
                      <span class="graph-language-legend__item">
                        <i style="background:${item.color}"></i>
                        ${escapeHtml(item.language)}
                        <small>${item.count}</small>
                      </span>
                    `
                  )
                  .join("")
              : `
                <span class="graph-language-legend__item">
                  <i style="background:${STAR_COLOR_STEPS[0]}"></i>
                  低 stars
                </span>
                <span class="graph-language-legend__item">
                  <i style="background:${STAR_COLOR_STEPS[2]}"></i>
                  中 stars
                </span>
                <span class="graph-language-legend__item">
                  <i style="background:${STAR_COLOR_STEPS[4]}"></i>
                  高 stars
                </span>
              `
          }
        </div>
      </div>
      <div class="graph-detail__card">
        <h3>主要關聯線索</h3>
        <div class="graph-detail__topics">
          ${
            highlightTopics.length
              ? highlightTopics
                  .map((topic) => `<span class="graph-detail__topic">${escapeHtml(topic)}</span>`)
                  .join("")
              : `<span class="graph-detail__topic">尚未找到明顯主題</span>`
          }
        </div>
      </div>
    </div>
  `;

  graphDetail.querySelector("#graphColorModeToggle")?.addEventListener("change", (event) => {
    graphState.colorByLanguage = event.target.checked;
    renderDetail();
    renderCanvas();
  });
}

function renderHeadline() {
  const neighbors = graphState.visibleNodes.filter((node) => !node.isRoot);
  const topNeighbor = neighbors[0];
  graphHeadline.textContent = `${graphState.rootTool.name} 的關聯圖`;
  graphSummary.innerHTML = topNeighbor
    ? `中心：${escapeHtml(graphState.rootTool.name)}<br>最接近：${escapeHtml(
        topNeighbor.tool.name
      )}<br><strong>滾輪縮放，左鍵查看資訊，右鍵可重新展開。</strong>`
    : `中心：${escapeHtml(graphState.rootTool.name)}<br>目前沒有足夠的相似 repo 可展開<br><strong>滾輪縮放，左鍵查看資訊，右鍵可重新展開。</strong>`;
}

function renderCanvas() {
  const width = Math.max(1100, Math.round((graphStage.clientWidth - 2) * 1.26));
  const height = Math.max(820, Math.round(width * 0.78));
  graphState.canvasSize.width = width;
  graphState.canvasSize.height = height;
  const positions = layoutGraph(graphState.visibleNodes, graphState.visibleEdges, width, height);
  const bounds = getGraphBounds(positions);
  const nodeMap = new Map(graphState.visibleNodes.map((node) => [node.tool.id, node]));

  const lines = graphState.visibleEdges
    .map((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const strokeWidth = edge.isPrimary ? clamp(edge.weight * 0.55, 1.2, 3.4) : clamp(edge.weight * 0.26, 0.8, 1.8);
      return `<line class="graph-edge${edge.isPrimary ? " graph-edge--strong" : ""}" x1="${source.x.toFixed(
        2
      )}" y1="${source.y.toFixed(2)}" x2="${target.x.toFixed(2)}" y2="${target.y.toFixed(
        2
      )}" stroke-width="${strokeWidth.toFixed(2)}"></line>`;
    })
    .join("");

  const nodes = graphState.visibleNodes
    .map((node, index) => {
      const point = positions.get(node.tool.id);
      const color = getNodeColor(node.tool, node.isRoot);
      const starsTier = getStarsTier(node.tool.stars);
      const strokeColor = node.isRoot
        ? "rgba(217, 119, 6, 0.9)"
        : graphState.colorByLanguage
        ? "rgba(255, 255, 255, 0.62)"
        : STAR_STROKE_STEPS[starsTier];
      const strokeWidth = node.isRoot ? 5 : graphState.colorByLanguage ? 2.4 : 1.8 + starsTier * 0.55;
      const radius = point.radius;
      const showLabel = node.isRoot || index < 10 || radius >= 29;
      const tooltipLines = [
        node.tool.name,
        node.tool.full_name,
        `${titleCaseLanguage(node.tool.language)} · ${formatNumber(node.tool.stars)} stars`,
        node.reasons?.[0] || "左鍵查看資訊，右鍵展開關聯圖",
      ];
      return `
        <g class="graph-node${node.isRoot ? " graph-node--root" : ""}${
          node.tool.id === graphState.selectedTool?.id ? " is-selected" : ""
        }" data-node-id="${
          node.tool.id
        }" transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})">
          <title>${escapeHtml(tooltipLines.join("\n"))}</title>
          <circle class="graph-node__halo" r="${(radius + (node.isRoot ? 18 : 10)).toFixed(2)}"></circle>
          <circle class="graph-node__body" r="${radius.toFixed(2)}" style="fill:${color};stroke:${strokeColor};stroke-width:${strokeWidth.toFixed(
            2
          )}"></circle>
          ${
            showLabel
              ? `
                <text class="graph-node__label" y="4">${escapeHtml(
                  node.tool.name
                )}</text>
              `
              : ""
          }
        </g>
      `;
    })
    .join("");

  graphCanvas.setAttribute("viewBox", `0 0 ${width} ${height}`);
  graphCanvas.innerHTML = `<g id="graphViewport">${lines}${nodes}</g>`;
  resetCamera(bounds);
  applyViewportTransform();
  graphStage.classList.add("is-pannable");

  graphCanvas.querySelectorAll("[data-node-id]").forEach((element) => {
    element.addEventListener("click", () => {
      const nextTool = nodeMap.get(Number(element.dataset.nodeId))?.tool;
      if (nextTool) {
        selectTool(nextTool);
      }
    });
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const nextTool = nodeMap.get(Number(element.dataset.nodeId))?.tool;
      if (nextTool) {
        showNodeMenu(nextTool, event);
      }
    });
  });
}

function handleWheelZoom(event) {
  if (!graphCanvas.querySelector("#graphViewport")) return;
  event.preventDefault();

  const point = getSvgPointFromClient(event.clientX, event.clientY);
  zoomGraphAtPoint(point, event.deltaY < 0 ? 1.12 : 0.9);
}

function zoomGraphAtPoint(point, zoomFactor) {
  const nextScale = clamp(
    graphState.camera.scale * zoomFactor,
    graphState.camera.minScale,
    graphState.camera.maxScale
  );

  if (nextScale === graphState.camera.scale) return;

  const contentX = (point.x - graphState.camera.translateX) / graphState.camera.scale;
  const contentY = (point.y - graphState.camera.translateY) / graphState.camera.scale;

  graphState.camera.scale = nextScale;
  graphState.camera.translateX = point.x - contentX * nextScale;
  graphState.camera.translateY = point.y - contentY * nextScale;
  applyViewportTransform();
}

function zoomGraphFromCenter(zoomFactor) {
  if (!graphCanvas.querySelector("#graphViewport")) return;
  const rect = graphCanvas.getBoundingClientRect();
  const point = getSvgPointFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2);
  zoomGraphAtPoint(point, zoomFactor);
}

function handlePointerDown(event) {
  if (event.target.closest("#graphNodeMenu")) return;
  if (event.target.closest("[data-node-id]")) return;
  hideNodeMenu();

  graphState.isDragging = true;
  graphState.dragPointerId = event.pointerId;
  graphState.dragStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    translateX: graphState.camera.translateX,
    translateY: graphState.camera.translateY,
  };

  graphStage.classList.add("is-dragging");
}

function handlePointerMove(event) {
  if (!graphState.isDragging || graphState.dragPointerId !== event.pointerId) return;

  const rect = graphCanvas.getBoundingClientRect();
  const scaleX = graphState.canvasSize.width / rect.width;
  const scaleY = graphState.canvasSize.height / rect.height;
  graphState.camera.translateX =
    graphState.dragStart.translateX + (event.clientX - graphState.dragStart.clientX) * scaleX;
  graphState.camera.translateY =
    graphState.dragStart.translateY + (event.clientY - graphState.dragStart.clientY) * scaleY;
  applyViewportTransform();
}

function endPointerDrag(event) {
  if (event && graphState.dragPointerId !== null && graphState.dragPointerId !== event.pointerId) {
    return;
  }

  graphState.isDragging = false;
  graphState.dragPointerId = null;
  graphState.dragStart = null;
  graphStage.classList.remove("is-dragging");
}

function updateSearchSuggestions() {
  projectSuggestions.innerHTML = graphState.tools
    .slice(0, 120)
    .map(
      (tool) =>
        `<option value="${escapeHtml(tool.name)}">${escapeHtml(tool.full_name)} · ${escapeHtml(
          titleCaseLanguage(tool.language)
        )}</option>`
    )
    .join("");
}

function findBestTool(rawQuery) {
  const query = normalizeText(rawQuery);
  if (!query) return graphState.rootTool;

  const tokens = tokenizeText(rawQuery);
  const scored = graphState.tools
    .map((tool) => {
      let score = 0;

      if (tool.normalizedName === query || tool.normalizedFullName === query) score += 90;
      if (tool.normalizedName.includes(query)) score += 40;
      if (tool.normalizedFullName.includes(query)) score += 30;
      if (tool.normalizedOwner.includes(query)) score += 18;
      if (tool.searchText.includes(query)) score += 14;

      tokens.forEach((token) => {
        if (tool.normalizedName.includes(token)) score += 18;
        if (tool.normalizedTopics.includes(token)) score += 16;
        if (tool.normalizedLanguage.includes(token)) score += 14;
        if (tool.searchText.includes(token)) score += 6;
      });

      return { tool, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.tool.stars || 0) - (a.tool.stars || 0));

  return scored[0]?.tool || null;
}

function renderEverything() {
  renderStats();
  renderHeadline();
  renderFocusTopics();
  renderRelationList();
  renderDetail();
  renderCanvas();
  graphLoading.hidden = true;
}

function focusTool(tool, options = {}) {
  graphState.rootTool = tool;
  graphState.selectedTool = tool;
  hideNodeMenu();
  setTag("graph_root_language", tool.language || "Unknown");
  setTag("graph_root_owner", tool.owner || "unknown");
  trackEvent("graph_repo_focused");

  const { nodes, edges } = buildNeighborhood(tool);
  graphState.visibleNodes = nodes;
  graphState.visibleEdges = edges;

  if (!options.preserveQuery) {
    graphSearchInput.value = tool.name;
  }

  graphSearchHint.textContent = "";
  renderEverything();
}

async function loadGraph() {
  try {
    const response = await fetch("/api/tools");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    graphState.tools = decorateTools(data.items || []).sort(
      (first, second) => (second.stars || 0) - (first.stars || 0)
    );

    if (graphState.tools.length === 0) {
      throw new Error("No tools available");
    }

    updateSearchSuggestions();
    focusTool(graphState.tools[0]);
  } catch (error) {
    graphLoading.hidden = false;
    graphLoading.textContent =
      "關聯圖載入失敗。請先確認本機 server 已經啟動，而且 data/tools.db 有有效資料。";
    graphHeadline.textContent = "關聯圖暫時無法載入";
    graphSummary.textContent = "目前無法從 /api/tools 取得 repo 資料。";
    graphDetail.innerHTML = `
      <p class="results-header__eyebrow">Selected Repo</p>
      <h2>讀取失敗</h2>
      <p class="results-header__description">請確認 server 與資料庫都正常，再重新整理頁面。</p>
    `;
  }
}

graphSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextTool = findBestTool(graphSearchInput.value);
  if (!nextTool) {
    graphSearchHint.textContent = `找不到「${graphSearchInput.value.trim()}」對應的 repo，可試試 owner、language 或 topic。`;
    return;
  }

  focusTool(nextTool);
  setTag("graph_search_has_query", graphSearchInput.value.trim() ? "true" : "false");
  trackEvent("graph_search_submitted");
});

graphNodeRange.addEventListener("input", (event) => {
  graphState.visibleRange = Number(event.target.value);
  setTag("graph_visible_range", String(graphState.visibleRange));
  trackEvent("graph_range_changed");
  graphNodeRangeValue.textContent = `${graphState.visibleRange} 個關聯 repo`;

  if (graphState.rootTool) {
    focusTool(graphState.rootTool, { preserveQuery: true });
  }
});

graphResetView.addEventListener("click", () => {
  if (graphState.rootTool) {
    trackEvent("graph_view_reset");
    hideNodeMenu();
    renderCanvas();
  }
});

graphZoomIn?.addEventListener("click", () => {
  trackEvent("graph_zoom_in_clicked");
  zoomGraphFromCenter(1.12);
});

graphZoomOut?.addEventListener("click", () => {
  trackEvent("graph_zoom_out_clicked");
  zoomGraphFromCenter(0.9);
});

graphNodeMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='expand']");
  if (!button) return;
  const nextTool = graphState.toolLookup.get(Number(graphNodeMenu.dataset.nodeId));
  if (nextTool) {
    trackEvent("graph_context_expand");
    focusTool(nextTool, { preserveQuery: true });
  }
});

graphStage.addEventListener("wheel", handleWheelZoom, { passive: false });
graphStage.addEventListener("pointerdown", handlePointerDown);
graphStage.addEventListener("pointermove", handlePointerMove);
graphStage.addEventListener("pointerup", endPointerDrag);
graphStage.addEventListener("pointerleave", endPointerDrag);
graphStage.addEventListener("pointercancel", endPointerDrag);
graphStage.addEventListener("dblclick", (event) => {
  if (event.target.closest("[data-node-id]")) return;
  if (graphState.rootTool) {
    renderCanvas();
  }
});

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  trackEvent("theme_toggled");
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (!graphState.rootTool) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    renderCanvas();
  }, 120);
});

graphNodeRange.value = String(graphState.visibleRange);
graphNodeRangeValue.textContent = `${graphState.visibleRange} 個關聯 repo`;
applyTheme(localStorage.getItem("gafy-theme") || "light");
setTag("page_type", "network-graph");
loadGraph();
