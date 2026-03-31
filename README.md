# coo-flags

Chrome extension for **x.com**: shows a **country flag emoji** for the App Store region shown under **About this account → Connected via**, injects it next to usernames in the timeline as you scroll, and lets you **hide posts** from accounts whose cached region matches selected flags.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose the `extension` folder in this repo.

## Usage

1. Browse X as usual. When you open **About this account** on a profile, the extension reads **Connected via** (e.g. “United States App Store”) and remembers that account’s region.
2. In the home timeline, a small flag appears next to the display name for accounts you have learned about (same session until you revisit About for others).
3. Click the extension icon → add regions to **Hide** (by country name or two-letter code). Posts from matching accounts are hidden once their region is known.

**Note:** X’s DOM changes often; if selectors break, update `content.js`. The country list lives in `countries.js` and can be extended for new labels.
