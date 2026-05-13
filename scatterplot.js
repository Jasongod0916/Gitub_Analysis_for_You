const themeToggle = document.querySelector("#themeToggle");
const themeToggleLabel = document.querySelector("#themeToggleLabel");

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  themeToggleLabel.textContent = nextTheme === "dark" ? "切換淺色" : "切換深色";
  localStorage.setItem("gafy-theme", nextTheme);
}

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("gafy-theme") || "light");
