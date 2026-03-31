# coo-flags

Chrome extension for **x.com**: shows a **country flag emoji** for the App Store region shown under **About this account → Connected via**, injects it next to usernames in the timeline as you scroll, and lets you **hide posts** from accounts whose cached region matches selected flags.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose the `extension` folder in this repo.

## Usage

1. Browse X as usual. When you open **About this account** on a profile, the extension reads **Connected via** (e.g. “United States App Store”) and **saves** that handle→region mapping in **local extension storage** (it survives closing the browser).
2. In the home timeline, a small flag appears next to the display name when the author’s handle is known—either from **your saved data**, from the **crowd cache** (see below), or after you open About for that account once.
3. Click the extension icon → add regions to **Hide** (by country name or two-letter code). Posts from matching accounts are hidden once their region is known.

### Optional crowd database

To share lookups so others do not each have to open About for every account:

1. Run the reference API in `server/` (Node 18+): `cd server && npm start` (default port **3847**; set `PORT` to change).
2. In the extension popup, enable **Use crowd API**, set **API base URL** (e.g. `http://127.0.0.1:3847` for local dev), then click **Allow network access** so Chrome grants the optional host permission.
3. When you learn a region from About, the extension **POSTs** an anonymous vote (`handle`, ISO `code`, optional `label`) to `/api/submit`. While scrolling, it **GETs** `/api/lookup?handles=a,b,c` for unknown authors and merges results into a **crowd cache** (your own saved rows still win on conflict).

The reference server stores votes in `server/data/regions.json` (gitignored) and returns the **most-reported** ISO code per handle. For production, deploy behind HTTPS, add auth/rate limits, and consider moderation—crowdsourced data can be wrong or abused.

**Note:** X’s DOM changes often; if selectors break, update `content.js`. The country list lives in `countries.js` and can be extended for new labels.
