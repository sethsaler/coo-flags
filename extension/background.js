const STORAGE_SYNC = {
  crowdEnabled: "cooFlagsCrowdEnabled",
  crowdApiBase: "cooFlagsCrowdApiBase",
};

function normalizeBase(url) {
  const s = String(url || "").trim().replace(/\/+$/, "");
  return s;
}

function originPatternForUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}/*`;
  } catch {
    return null;
  }
}

async function ensureCrowdPermission(apiBase) {
  const pattern = originPatternForUrl(apiBase);
  if (!pattern) return { ok: false, error: "Invalid API URL." };
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [pattern] }, (has) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (has) {
        resolve({ ok: true, pattern });
        return;
      }
      chrome.permissions.request({ origins: [pattern] }, (granted) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve({ ok: !!granted, pattern, denied: !granted });
      });
    });
  });
}

function crowdEndpoints(base) {
  const b = normalizeBase(base);
  return {
    lookup: `${b}/api/lookup`,
    submit: `${b}/api/submit`,
  };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && data.error) || text || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "cooFlags:crowdSubmit") {
    (async () => {
      const { handle, code, label } = msg.payload || {};
      if (!handle || !code) {
        sendResponse({ ok: false, error: "Missing handle or code." });
        return;
      }
      const sync = await chrome.storage.sync.get([
        STORAGE_SYNC.crowdEnabled,
        STORAGE_SYNC.crowdApiBase,
      ]);
      if (!sync[STORAGE_SYNC.crowdEnabled]) {
        sendResponse({ ok: true, skipped: true });
        return;
      }
      const base = normalizeBase(sync[STORAGE_SYNC.crowdApiBase]);
      if (!base) {
        sendResponse({ ok: false, error: "Crowd API base URL is not set." });
        return;
      }
      const perm = await ensureCrowdPermission(base);
      if (!perm.ok) {
        sendResponse({ ok: false, error: perm.error || "Permission denied." });
        return;
      }
      if (perm.denied) {
        sendResponse({ ok: false, error: "Host permission was not granted." });
        return;
      }
      try {
        const { submit } = crowdEndpoints(base);
        await fetchJson(submit, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handle: String(handle).toLowerCase(),
            code: String(code).toUpperCase(),
            label: label || "",
            extVersion: chrome.runtime.getManifest().version,
          }),
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();
    return true;
  }

  if (msg.type === "cooFlags:crowdLookup") {
    (async () => {
      const handles = Array.isArray(msg.handles) ? msg.handles : [];
      const uniq = [...new Set(handles.map((h) => String(h).toLowerCase()).filter(Boolean))];
      if (!uniq.length) {
        sendResponse({ ok: true, regions: {} });
        return;
      }
      const sync = await chrome.storage.sync.get([
        STORAGE_SYNC.crowdEnabled,
        STORAGE_SYNC.crowdApiBase,
      ]);
      if (!sync[STORAGE_SYNC.crowdEnabled]) {
        sendResponse({ ok: true, regions: {}, skipped: true });
        return;
      }
      const base = normalizeBase(sync[STORAGE_SYNC.crowdApiBase]);
      if (!base) {
        sendResponse({ ok: false, error: "Crowd API base URL is not set." });
        return;
      }
      const perm = await ensureCrowdPermission(base);
      if (!perm.ok || perm.denied) {
        sendResponse({ ok: true, regions: {}, skipped: true, permission: false });
        return;
      }
      try {
        const { lookup } = crowdEndpoints(base);
        const url = `${lookup}?handles=${encodeURIComponent(uniq.join(","))}`;
        const data = await fetchJson(url, { method: "GET" });
        const regions = (data && data.regions) || {};
        sendResponse({ ok: true, regions });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e), regions: {} });
      }
    })();
    return true;
  }

  if (msg.type === "cooFlags:requestCrowdPermission") {
    (async () => {
      const sync = await chrome.storage.sync.get([STORAGE_SYNC.crowdApiBase]);
      const base = normalizeBase(sync[STORAGE_SYNC.crowdApiBase]);
      if (!base) {
        sendResponse({ ok: false, error: "Set an API base URL first." });
        return;
      }
      const perm = await ensureCrowdPermission(base);
      sendResponse({
        ok: perm.ok && !perm.denied,
        error: perm.error,
        denied: perm.denied,
      });
    })();
    return true;
  }
});
