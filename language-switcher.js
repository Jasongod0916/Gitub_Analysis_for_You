const languageSelect = document.querySelector("#languageSelect");
const LANGUAGE_STORAGE_KEY = "gafy-language";
const SUPPORTED_LANGUAGES = new Set(["zh-Hant", "en", "ja"]);
const LANGUAGE_PREFIXES = new Set(["zh-Hant", "en", "ja"]);
let activeTranslations = {};

function getLanguageFromPath() {
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  return LANGUAGE_PREFIXES.has(firstSegment) ? firstSegment : null;
}

function getUnprefixedPath() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (pathParts.length && LANGUAGE_PREFIXES.has(pathParts[0])) {
    pathParts.shift();
  }

  const path = `/${pathParts.join("/")}`;
  return path === "/" || path === "/index.html" ? "/" : path;
}

function getLocalizedPath(language) {
  const unprefixedPath = getUnprefixedPath();
  if (language === "zh-Hant") return unprefixedPath;

  const normalizedPath = unprefixedPath === "/" ? "/" : unprefixedPath;
  return `/${language}${normalizedPath}`;
}

function getInitialLanguage() {
  const pathLanguage = getLanguageFromPath();
  if (pathLanguage) return pathLanguage;

  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (SUPPORTED_LANGUAGES.has(savedLanguage)) return savedLanguage;

  const browserLanguage = navigator.language || "";
  if (browserLanguage.toLowerCase().startsWith("ja")) return "ja";
  if (browserLanguage.toLowerCase().startsWith("en")) return "en";
  return "zh-Hant";
}

async function loadTranslations(language) {
  const response = await fetch(`/i18n/${language}.json`, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load translations for ${language}`);
  }
  return response.json();
}

function translateElement(element, translations) {
  const textKey = element.dataset.i18n;
  const placeholderKey = element.dataset.i18nPlaceholder;
  const ariaKey = element.dataset.i18nAriaLabel;

  if (textKey && translations[textKey]) {
    element.textContent = translations[textKey];
  }

  if (placeholderKey && translations[placeholderKey]) {
    element.setAttribute("placeholder", translations[placeholderKey]);
  }

  if (ariaKey && translations[ariaKey]) {
    element.setAttribute("aria-label", translations[ariaKey]);
  }
}

function translatePage(translations) {
  window.gafyTranslations = translations;
  document.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-aria-label]").forEach((element) => {
    translateElement(element, translations);
  });
  syncLocalizedThemeLabel();
  window.dispatchEvent(new CustomEvent("gafy:languagechange", { detail: { translations } }));
}

function syncLocalizedThemeLabel() {
  const themeToggleLabel = document.querySelector("#themeToggleLabel");
  if (!themeToggleLabel) return;

  const nextTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const labelKey = nextTheme === "dark" ? "theme.light" : "theme.dark";
  themeToggleLabel.textContent = activeTranslations[labelKey] || themeToggleLabel.textContent;
}

async function applyLanguage(language) {
  const nextLanguage = SUPPORTED_LANGUAGES.has(language) ? language : "zh-Hant";
  document.documentElement.lang = nextLanguage;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);

  if (languageSelect) {
    languageSelect.value = nextLanguage;
  }

  try {
    activeTranslations = await loadTranslations(nextLanguage);
    translatePage(activeTranslations);
  } catch (error) {
    console.warn(error);
  }
}

applyLanguage(getInitialLanguage());

languageSelect?.addEventListener("change", (event) => {
  const nextLanguage = event.target.value;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  window.setClarityTag?.("language", nextLanguage);

  const nextPath = getLocalizedPath(nextLanguage);
  if (nextPath !== window.location.pathname) {
    window.location.assign(nextPath);
    return;
  }

  applyLanguage(nextLanguage);
});

document.querySelector("#themeToggle")?.addEventListener("click", () => {
  window.requestAnimationFrame(syncLocalizedThemeLabel);
});
