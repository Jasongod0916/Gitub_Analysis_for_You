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
  themeToggleLabel.textContent = nextTheme === "dark" ? "切換淺色" : "切換深色";
  localStorage.setItem("gafy-theme", nextTheme);
  setTag("theme", nextTheme);
}

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  trackEvent("theme_toggled");
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("gafy-theme") || "light");
setTag("page_type", "about");
