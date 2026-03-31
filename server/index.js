/**
 * Reference server: stores handle -> region votes from extension clients.
 * POST /api/submit  { handle, code, label?, extVersion? }
 * GET  /api/lookup?handles=a,b,c  -> { regions: { a: { code, label, reports }, ... } }
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const PORT = Number(process.env.PORT || 3847);
const DATA_PATH = path.join(__dirname, "data", "regions.json");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

async function loadDb() {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const j = JSON.parse(raw);
    if (j && typeof j.handles === "object") return j;
  } catch {
    /* missing or invalid */
  }
  return { handles: {} };
}

async function saveDb(db) {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  const tmp = `${DATA_PATH}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DATA_PATH);
}

function bestCodeFromVotes(votes) {
  if (!votes || typeof votes !== "object") return null;
  let best = null;
  let bestN = -1;
  for (const [code, n] of Object.entries(votes)) {
    const c = String(code).toUpperCase();
    const count = Number(n) || 0;
    if (count > bestN || (count === bestN && c < (best || ""))) {
      bestN = count;
      best = c;
    }
  }
  return best;
}

function json(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(s);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1`);

  if (req.method === "GET" && url.pathname === "/api/lookup") {
    const handlesParam = url.searchParams.get("handles") || "";
    const list = handlesParam
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const db = await loadDb();
    const regions = {};
    for (const h of list) {
      const row = db.handles[h];
      if (!row || !row.votes) continue;
      const code = bestCodeFromVotes(row.votes);
      if (!code) continue;
      const reports = Number(row.votes[code]) || 0;
      regions[h] = {
        code,
        label: (row.labels && row.labels[code]) || "",
        reports,
        updatedAt: row.updatedAt || 0,
      };
    }
    json(res, 200, { regions });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/submit") {
    let body = "";
    try {
      body = await readBody(req);
    } catch {
      json(res, 400, { error: "Bad body" });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      json(res, 400, { error: "Invalid JSON" });
      return;
    }
    const handle = String(payload.handle || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    const code = String(payload.code || "")
      .trim()
      .toUpperCase();
    const label = String(payload.label || "").trim();
    if (!handle || !/^[a-z0-9_]{1,64}$/i.test(handle)) {
      json(res, 400, { error: "Invalid handle" });
      return;
    }
    if (!code || !/^[A-Z]{2}$/.test(code)) {
      json(res, 400, { error: "Invalid code" });
      return;
    }

    const db = await loadDb();
    if (!db.handles[handle]) {
      db.handles[handle] = { votes: {}, labels: {}, updatedAt: 0 };
    }
    const row = db.handles[handle];
    row.votes = row.votes || {};
    row.labels = row.labels || {};
    row.votes[code] = (Number(row.votes[code]) || 0) + 1;
    if (label) row.labels[code] = label;
    row.updatedAt = Date.now();
    await saveDb(db);
    json(res, 200, { ok: true, code, handle, reports: row.votes[code] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`coo-flags crowd API listening on http://127.0.0.1:${PORT}`);
});
