(function () {
  const STORAGE_KEY_HIDDEN = "cooFlagsHiddenAlpha2";
  const STORAGE_KEY_LOCAL_MAP = "cooFlagsRegionMapLocal";
  const STORAGE_KEY_REMOTE_MAP = "cooFlagsRegionMapRemote";
  const STORAGE_CROWD_ENABLED = "cooFlagsCrowdEnabled";
  const STORAGE_CROWD_API_BASE = "cooFlagsCrowdApiBase";

  const form = document.getElementById("add-form");
  const input = document.getElementById("region-input");
  const errorEl = document.getElementById("error");
  const listEl = document.getElementById("hidden-list");
  const emptyEl = document.getElementById("empty");

  const crowdEnabledEl = document.getElementById("crowd-enabled");
  const crowdApiBaseEl = document.getElementById("crowd-api-base");
  const crowdPermissionBtn = document.getElementById("crowd-permission-btn");
  const crowdStatusEl = document.getElementById("crowd-status");
  const clearRemoteBtn = document.getElementById("clear-remote-btn");
  const clearLocalBtn = document.getElementById("clear-local-btn");

  const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

  function alpha2ToFlagEmoji(code) {
    if (!code || code.length !== 2) return "";
    const A = 0x1f1e6;
    const up = code.toUpperCase();
    const a = up.charCodeAt(0);
    const b = up.charCodeAt(1);
    if (a < 65 || a > 90 || b < 65 || b > 90) return "";
    return String.fromCodePoint(A + (a - 65), A + (b - 65));
  }

  function resolveToCode(raw) {
    const s = String(raw).trim();
    if (!s) return null;
    if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
    const withStore = /\bapp\s+store\b/i.test(s) ? s : `${s} App Store`;
    const parsed = CooFlagsCountries.parseConnectedVia(withStore);
    return parsed && parsed.code ? parsed.code.toUpperCase() : null;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function setCrowdStatus(msg, kind) {
    crowdStatusEl.textContent = msg || "";
    crowdStatusEl.classList.remove("ok", "err");
    if (kind === "ok") crowdStatusEl.classList.add("ok");
    if (kind === "err") crowdStatusEl.classList.add("err");
  }

  function loadCrowdSettings() {
    chrome.storage.sync.get([STORAGE_CROWD_ENABLED, STORAGE_CROWD_API_BASE], (res) => {
      crowdEnabledEl.checked = !!res[STORAGE_CROWD_ENABLED];
      crowdApiBaseEl.value = res[STORAGE_CROWD_API_BASE] || "";
    });
  }

  function saveCrowdSettings() {
    const base = crowdApiBaseEl.value.trim().replace(/\/+$/, "");
    chrome.storage.sync.set(
      {
        [STORAGE_CROWD_ENABLED]: crowdEnabledEl.checked,
        [STORAGE_CROWD_API_BASE]: base,
      },
      () => {
        if (chrome.runtime.lastError) {
          setCrowdStatus(chrome.runtime.lastError.message || "Could not save.", "err");
          return;
        }
        setCrowdStatus("Saved.", "ok");
      }
    );
  }

  crowdEnabledEl.addEventListener("change", saveCrowdSettings);

  let crowdBaseDebounce;
  crowdApiBaseEl.addEventListener("input", () => {
    clearTimeout(crowdBaseDebounce);
    crowdBaseDebounce = setTimeout(saveCrowdSettings, 500);
  });

  crowdPermissionBtn.addEventListener("click", () => {
    setCrowdStatus("Requesting permission…", "");
    chrome.runtime.sendMessage({ type: "cooFlags:requestCrowdPermission" }, (res) => {
      if (chrome.runtime.lastError) {
        setCrowdStatus(chrome.runtime.lastError.message || "Could not request permission.", "err");
        return;
      }
      if (res && res.ok) setCrowdStatus("Network access granted for this API host.", "ok");
      else if (res && res.denied) setCrowdStatus("Permission denied. Try again or check the URL.", "err");
      else setCrowdStatus((res && res.error) || "Could not grant permission.", "err");
    });
  });

  clearRemoteBtn.addEventListener("click", () => {
    chrome.storage.local.remove([STORAGE_KEY_REMOTE_MAP], () => {
      if (chrome.runtime.lastError) {
        setCrowdStatus(chrome.runtime.lastError.message || "Clear failed.", "err");
        return;
      }
      setCrowdStatus("Crowd cache cleared.", "ok");
    });
  });

  clearLocalBtn.addEventListener("click", () => {
    chrome.storage.local.remove([STORAGE_KEY_LOCAL_MAP], () => {
      if (chrome.runtime.lastError) {
        setCrowdStatus(chrome.runtime.lastError.message || "Clear failed.", "err");
        return;
      }
      setCrowdStatus("Your saved lookups cleared.", "ok");
    });
  });

  function loadList() {
    chrome.storage.sync.get([STORAGE_KEY_HIDDEN], (res) => {
      const arr = Array.isArray(res[STORAGE_KEY_HIDDEN]) ? res[STORAGE_KEY_HIDDEN] : [];
      const codes = [...new Set(arr.map((c) => String(c).toUpperCase()))].sort();
      renderList(codes);
    });
  }

  function saveList(codes) {
    chrome.storage.sync.set({ [STORAGE_KEY_HIDDEN]: codes }, () => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || "Could not save settings.");
        return;
      }
      showError("");
      renderList(codes);
    });
  }

  function renderList(codes) {
    listEl.innerHTML = "";
    emptyEl.hidden = codes.length > 0;
    for (const code of codes) {
      const li = document.createElement("li");
      let label = code;
      try {
        label = regionNames.of(code);
      } catch {
        /* ignore invalid code for display */
      }
      const emoji = alpha2ToFlagEmoji(code) || "🏳️";
      li.innerHTML = `
        <div class="meta">
          <span class="emoji" aria-hidden="true">${emoji}</span>
          <span class="name" title="${label}">${label}</span>
          <span class="code">${code}</span>
        </div>
        <button type="button" class="remove" data-code="${code}">Remove</button>
      `;
      listEl.appendChild(li);
    }
    listEl.querySelectorAll("button.remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rm = btn.getAttribute("data-code");
        chrome.storage.sync.get([STORAGE_KEY_HIDDEN], (res) => {
          const cur = Array.isArray(res[STORAGE_KEY_HIDDEN]) ? res[STORAGE_KEY_HIDDEN] : [];
          const next = cur.filter((c) => String(c).toUpperCase() !== rm);
          saveList(next);
        });
      });
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showError("");
    const code = resolveToCode(input.value);
    if (!code) {
      showError("Could not match that text to a region. Try a country name or a two-letter code (e.g. US).");
      return;
    }
    chrome.storage.sync.get([STORAGE_KEY_HIDDEN], (res) => {
      const cur = Array.isArray(res[STORAGE_KEY_HIDDEN]) ? res[STORAGE_KEY_HIDDEN] : [];
      const set = new Set(cur.map((c) => String(c).toUpperCase()));
      set.add(code);
      saveList([...set].sort());
      input.value = "";
    });
  });

  loadCrowdSettings();
  loadList();
})();
