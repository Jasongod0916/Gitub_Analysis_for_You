(() => {
  const DEFAULT_PROJECT_ID = "wpum7uph30";
  const projectId = window.CLARITY_PROJECT_ID || DEFAULT_PROJECT_ID;
  const isConfigured =
    typeof projectId === "string" &&
    projectId.trim() !== "" &&
    projectId !== DEFAULT_PROJECT_ID;

  function callClarity(method, ...args) {
    if (typeof window.clarity !== "function") return;
    window.clarity(method, ...args);
  }

  function setClarityTag(key, value) {
    if (!isConfigured || !key || value == null || value === "") return;
    callClarity("set", key, value);
  }

  function trackClarityEvent(eventName) {
    if (!isConfigured || !eventName) return;
    callClarity("event", eventName);
  }

  function identifyClarityUser(customId, customSessionId, customPageId, friendlyName) {
    if (!isConfigured || !customId) return;
    callClarity("identify", customId, customSessionId, customPageId, friendlyName);
  }

  function initClarity() {
    if (!isConfigured) {
      console.info(
        "[Clarity] Tracking is disabled. Set window.CLARITY_PROJECT_ID in clarity.js to enable it."
      );
      return;
    }

    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", projectId);

    setClarityTag("site_section", document.body?.dataset?.clarityPage || "unknown");
  }

  window.trackClarityEvent = trackClarityEvent;
  window.setClarityTag = setClarityTag;
  window.identifyClarityUser = identifyClarityUser;
  window.CLARITY_ENABLED = isConfigured;

  initClarity();
})();
