const homeThemeToggle = document.querySelector("#themeToggle");
const homeThemeToggleLabel = document.querySelector("#themeToggleLabel");

function syncHomeThemeLabel() {
  if (!homeThemeToggle || !homeThemeToggleLabel) return;
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  homeThemeToggleLabel.textContent = nextTheme === "dark" ? "淺色" : "深色";
}

syncHomeThemeLabel();
homeThemeToggle?.addEventListener("click", () => {
  window.requestAnimationFrame(syncHomeThemeLabel);
});
