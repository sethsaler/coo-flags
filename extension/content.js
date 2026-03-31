(function () {
  const STORAGE_KEY_HIDDEN = "cooFlagsHiddenAlpha2";
  const STORAGE_KEY_LOCAL_MAP = "cooFlagsRegionMapLocal";
  const STORAGE_KEY_REMOTE_MAP = "cooFlagsRegionMapRemote";

  const BADGE_CLASS = "coo-flags-badge";
  const HIDDEN_ARTICLE_CLASS = "coo-flags-hidden";
  const DATA_HANDLE = "data-coo-flags-handle";
  const DATA_CODE = "data-coo-flags-code";

  const RESERVED_SEGMENTS = new Set([
    "home",
    "explore",
    "notifications",
    "messages",
    "settings",
    "compose",
    "search",
    "i",
    "intent",
    "hashtag",
    "lists",
    "topics",
    "connect_people",
    "tos",
    "privacy",
    "login",
    "signup",
    "following",
    "followers",
    "verified_followers",
    "highlights",
    "media",
    "likes",
    "communities",
    "jobs",
    "teams",
    "help",
    "rules",
    "ads",
    "business",
    "download",
  ]);

  /** @type {Set<string>} */
  let hiddenCodes = new Set();
  /** @type {Map<string, { code: string, emoji: string, label: string, source?: string }>} */
  const handleToRegion = new Map();
  /** @type {Record<string, { code: string, label?: string }>} */
  let localMap = {};
  /** @type {Record<string, { code: string, label?: string }>} */
  let remoteMap = {};

  let lookupTimer = null;
  const pendingCrowdLookup = new Set();

  function normalizeHandle(h) {
    if (!h) return "";
    const s = String(h).replace(/^@/, "").trim().toLowerCase();
    return s;
  }

  function regionEntryFromRow(code, label, source) {
    const up = String(code).toUpperCase();
    const emoji = CooFlagsCountries.flagFromCode(up) || "";
    return { code: up, emoji, label: label || "", source: source || "" };
  }

  function mergeMaps() {
    handleToRegion.clear();
    for (const [h, v] of Object.entries(remoteMap)) {
      const handle = normalizeHandle(h);
      if (!handle || !v || !v.code) continue;
      handleToRegion.set(handle, regionEntryFromRow(v.code, v.label, "crowd"));
    }
    for (const [h, v] of Object.entries(localMap)) {
      const handle = normalizeHandle(h);
      if (!handle || !v || !v.code) continue;
      handleToRegion.set(handle, regionEntryFromRow(v.code, v.label, "you"));
    }
  }

  function loadRegionMaps() {
    chrome.storage.local.get([STORAGE_KEY_LOCAL_MAP, STORAGE_KEY_REMOTE_MAP], (res) => {
      localMap =
        res[STORAGE_KEY_LOCAL_MAP] && typeof res[STORAGE_KEY_LOCAL_MAP] === "object"
          ? res[STORAGE_KEY_LOCAL_MAP]
          : {};
      remoteMap =
        res[STORAGE_KEY_REMOTE_MAP] && typeof res[STORAGE_KEY_REMOTE_MAP] === "object"
          ? res[STORAGE_KEY_REMOTE_MAP]
          : {};
      mergeMaps();
      scanVisibleArticles();
    });
  }

  function saveLocalMap(next) {
    chrome.storage.local.set({ [STORAGE_KEY_LOCAL_MAP]: next }, () => {
      if (chrome.runtime.lastError) return;
      localMap = next;
      mergeMaps();
      scanVisibleArticles();
    });
  }

  function saveRemoteMapPatch(patch) {
    const merged = { ...remoteMap, ...patch };
    chrome.storage.local.set({ [STORAGE_KEY_REMOTE_MAP]: merged }, () => {
      if (chrome.runtime.lastError) return;
      remoteMap = merged;
      mergeMaps();
      scanVisibleArticles();
    });
  }

  function persistLocalRegion(handle, code, label) {
    const h = normalizeHandle(handle);
    if (!h || !code) return;
    const up = String(code).toUpperCase();
    const next = { ...localMap, [h]: { code: up, label: label || "" } };
    saveLocalMap(next);
    chrome.runtime.sendMessage(
      {
        type: "cooFlags:crowdSubmit",
        payload: { handle: h, code: up, label: label || "" },
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  }

  function scheduleCrowdLookup(handles) {
    for (const h of handles) {
      const hn = normalizeHandle(h);
      if (!hn) continue;
      if (handleToRegion.has(hn)) continue;
      pendingCrowdLookup.add(hn);
    }
    if (lookupTimer) clearTimeout(lookupTimer);
    lookupTimer = setTimeout(runCrowdLookup, 400);
  }

  function runCrowdLookup() {
    lookupTimer = null;
    const need = [...pendingCrowdLookup].filter((h) => !handleToRegion.has(h));
    pendingCrowdLookup.clear();
    if (!need.length) return;
    chrome.runtime.sendMessage({ type: "cooFlags:crowdLookup", handles: need }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok || !res.regions) return;
      /** @type {Record<string, { code: string, label?: string }>} */
      const patch = {};
      for (const [h, row] of Object.entries(res.regions)) {
        const hn = normalizeHandle(h);
        if (!hn || !row || !row.code) continue;
        patch[hn] = { code: String(row.code).toUpperCase(), label: row.label || "" };
      }
      if (Object.keys(patch).length) saveRemoteMapPatch(patch);
    });
  }

  function loadHidden() {
    chrome.storage.sync.get([STORAGE_KEY_HIDDEN], (res) => {
      const arr = Array.isArray(res[STORAGE_KEY_HIDDEN]) ? res[STORAGE_KEY_HIDDEN] : [];
      hiddenCodes = new Set(arr.map((c) => String(c).toUpperCase()));
      scanVisibleArticles();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY_HIDDEN]) {
      const nv = changes[STORAGE_KEY_HIDDEN].newValue;
      const arr = Array.isArray(nv) ? nv : [];
      hiddenCodes = new Set(arr.map((c) => String(c).toUpperCase()));
      scanVisibleArticles();
    }
    if (area === "local") {
      if (changes[STORAGE_KEY_LOCAL_MAP]) {
        const nv = changes[STORAGE_KEY_LOCAL_MAP].newValue;
        localMap = nv && typeof nv === "object" ? nv : {};
      }
      if (changes[STORAGE_KEY_REMOTE_MAP]) {
        const nv = changes[STORAGE_KEY_REMOTE_MAP].newValue;
        remoteMap = nv && typeof nv === "object" ? nv : {};
      }
      if (changes[STORAGE_KEY_LOCAL_MAP] || changes[STORAGE_KEY_REMOTE_MAP]) {
        mergeMaps();
        scanVisibleArticles();
      }
    }
  });

  function extractHandleFromArticle(article) {
    const userNameRoot = article.querySelector('[data-testid="User-Name"]');
    if (userNameRoot) {
      const statusLinks = userNameRoot.querySelectorAll('a[href*="/status/"]');
      for (const a of statusLinks) {
        const href = a.getAttribute("href") || "";
        const seg = href.replace(/^\//, "").split(/[/?#]/)[0];
        if (seg && !RESERVED_SEGMENTS.has(seg.toLowerCase())) {
          return normalizeHandle(seg);
        }
      }
      const links = userNameRoot.querySelectorAll('a[href^="/"]');
      for (const a of links) {
        const href = a.getAttribute("href") || "";
        const seg = href.replace(/^\//, "").split(/[/?#]/)[0];
        if (seg && !RESERVED_SEGMENTS.has(seg.toLowerCase())) {
          return normalizeHandle(seg);
        }
      }
    }
    const candidates = article.querySelectorAll('a[href^="/"][role="link"]');
    for (const a of candidates) {
      const href = a.getAttribute("href") || "";
      const parts = href.replace(/^\//, "").split(/[/?#]/);
      if (parts.length === 1 && parts[0] && !RESERVED_SEGMENTS.has(parts[0].toLowerCase())) {
        return normalizeHandle(parts[0]);
      }
    }
    return "";
  }

  function findConnectedViaRow(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return null;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    /** @type {Element[]} */
    const hits = [];
    let n;
    while ((n = tw.nextNode())) {
      const t = n.textContent || "";
      if (t.includes("Connected via")) hits.push(n);
    }
    if (!hits.length) return null;
    for (const el of hits) {
      const inner = hits.some((x) => x !== el && el.contains(x));
      if (!inner) return el.closest("div") || el;
    }
    return hits[0];
  }

  function harvestConnectedViaFromNode(node) {
    const row = findConnectedViaRow(node);
    if (!row) return;
    const dialog = row.closest('[role="dialog"]');
    if (!dialog) return;
    const text = (row.textContent || "").replace(/\s+/g, " ").trim();
    const idx = text.indexOf("Connected via");
    if (idx === -1) return;
    const after = text.slice(idx + "Connected via".length).trim();
    if (!after) return;
    const parsed = CooFlagsCountries.parseConnectedVia(after);
    if (!parsed || !parsed.code) return;

    const profileRoot =
      row.closest('[data-testid="UserProfileHeader_Items"]') ||
      row.closest('[data-testid="primaryColumn"]') ||
      row.closest("main") ||
      document;
    const handle = findHandleNearAboutFlow(profileRoot, row);
    if (!handle) return;
    persistLocalRegion(handle, parsed.code, after);
  }

  function findHandleNearAboutFlow(root, connectedRow) {
    const header = root.querySelector('[data-testid="UserName"]');
    if (header) {
      const m = (header.textContent || "").match(/@([A-Za-z0-9_]+)/);
      if (m) return m[1];
    }
    const links = root.querySelectorAll('a[href^="/"]');
    for (const a of links) {
      const href = (a.getAttribute("href") || "").replace(/^\//, "");
      const seg = href.split(/[/?#]/)[0];
      if (seg && !RESERVED_SEGMENTS.has(seg.toLowerCase()) && a.textContent.includes("@")) {
        const mm = a.textContent.match(/@([A-Za-z0-9_]+)/);
        if (mm) return mm[1];
      }
    }
    let el = connectedRow;
    for (let i = 0; i < 20 && el; i++) {
      const t = el.textContent || "";
      const mm = t.match(/@([A-Za-z0-9_]+)/);
      if (mm) return mm[1];
      el = el.parentElement;
    }
    return "";
  }

  function ensureBadgeOnArticle(article, handle) {
    const h = normalizeHandle(handle);
    const info = handleToRegion.get(h);
    if (!info || !info.emoji) {
      article.removeAttribute(DATA_CODE);
      const old = article.querySelector(`.${BADGE_CLASS}`);
      if (old) old.remove();
      applyHide(article, null);
      return;
    }

    article.setAttribute(DATA_CODE, info.code);

    const userNameRoot = article.querySelector('[data-testid="User-Name"]');
    if (!userNameRoot) return;

    const src =
      info.source === "you" ? "You (saved)" : info.source === "crowd" ? "Crowd" : "";
    const title = src ? `App Store: ${info.label || info.code} (${src})` : `App Store: ${info.label || info.code}`;

    const existingBadges = userNameRoot.querySelectorAll(`.${BADGE_CLASS}`);
    existingBadges.forEach((b, i) => {
      if (i > 0) b.remove();
    });
    let badge = userNameRoot.querySelector(`.${BADGE_CLASS}`);
    if (!badge) {
      badge = document.createElement("span");
      badge.className = BADGE_CLASS;
      badge.setAttribute("title", title);
      badge.textContent = info.emoji;
      const displayNameSpan = userNameRoot.querySelector("span span");
      if (displayNameSpan && displayNameSpan.parentElement) {
        displayNameSpan.parentElement.appendChild(badge);
      } else {
        userNameRoot.appendChild(badge);
      }
    } else {
      badge.textContent = info.emoji;
      badge.setAttribute("title", title);
    }

    applyHide(article, info.code);
  }

  function applyHide(article, code) {
    if (!code) {
      article.classList.remove(HIDDEN_ARTICLE_CLASS);
      return;
    }
    const up = String(code).toUpperCase();
    if (hiddenCodes.has(up)) article.classList.add(HIDDEN_ARTICLE_CLASS);
    else article.classList.remove(HIDDEN_ARTICLE_CLASS);
  }

  function scanVisibleArticles() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    const handlesNeedingCrowd = [];
    articles.forEach((article) => {
      const handle = extractHandleFromArticle(article);
      if (!handle) return;
      article.setAttribute(DATA_HANDLE, handle);
      if (!handleToRegion.has(handle)) handlesNeedingCrowd.push(handle);
      ensureBadgeOnArticle(article, handle);
    });
    if (handlesNeedingCrowd.length) scheduleCrowdLookup(handlesNeedingCrowd);
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        /** @type {Element} */
        const el = n;
        const text = el.textContent || "";
        if (text.includes("Connected via")) {
          harvestConnectedViaFromNode(el);
        }
        if (el.matches?.('article[data-testid="tweet"]')) {
          const handle = extractHandleFromArticle(el);
          if (handle) {
            if (!handleToRegion.has(handle)) pendingCrowdLookup.add(handle);
            ensureBadgeOnArticle(el, handle);
          }
        }
        el.querySelectorAll?.('article[data-testid="tweet"]').forEach((a) => {
          const handle = extractHandleFromArticle(a);
          if (handle) {
            if (!handleToRegion.has(handle)) pendingCrowdLookup.add(handle);
            ensureBadgeOnArticle(a, handle);
          }
        });
      }
    }
    scanVisibleArticles();
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  loadRegionMaps();
  loadHidden();
  scanVisibleArticles();
})();
