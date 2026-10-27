# Drops Hub — browser bridge extension

This folder is the Chrome/Edge (Chromium) extension that feeds the Drops Hub dashboard with data
from **your own** twitch.tv tab.

## What it does

- Runs on `twitch.tv` and watches the GraphQL responses the page itself requests when it loads the
  Drops dashboard.
- Saves that payload locally (`chrome.storage.local`).
- On the Drops Hub dashboard it answers the app's `postMessage` request with the saved snapshot.

## What it does **not** do

- It never asks for a password, a token or a cookie.
- It does not send requests to Twitch on your behalf and does not modify Twitch pages.
- It does not fake viewing time: no automation, no heartbeats, nothing that could get an account
  banned.

## Install

### Chrome / Edge (Chromium)

1. Download `drops-hub-extension.zip` from the deployed site (or use this folder as is).
2. Unpack it somewhere permanent.
3. Open `chrome://extensions`, enable **Developer mode**.
4. Click **Load unpacked** and select the unpacked `extension` folder.
5. Open <https://www.twitch.tv/drops/campaigns> — the snapshot is captured automatically.
6. Return to the Drops Hub tab and press **Проверить снова** (or reload the page).

### Zen / Firefox

Requires Firefox 140+ (Zen 1.5+).

1. Download `drops-hub-extension-firefox.zip` and unpack it.
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**.
3. Select `manifest.json` from the unpacked folder.
4. Open <https://www.twitch.tv/drops/campaigns>, then return to the dashboard.

Temporary add-ons are removed on browser restart. For a permanent install, submit the archive to
[addons.mozilla.org](https://addons.mozilla.org/developers/) as a self-distributed add-on — Mozilla
signs it and returns an `.xpi`.

The Firefox build only differs by the `browser_specific_settings.gecko` key in `manifest.json`, which
Chromium builds drop.

## Packaging

Both archives are generated from this folder:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-extension.ps1
```

| Output | Notes |
| --- | --- |
| `public/drops-hub-extension.zip` | Chromium build, `browser_specific_settings` removed. |
| `public/drops-hub-extension-firefox.zip` | Firefox / Zen build, manifest as is. |

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest: storage permission, content scripts for twitch.tv and the dashboard. |
| `capture.js` | Runs in the page world (`world: "MAIN"`), wraps `fetch`, forwards `ViewerDropsDashboard` payloads. |
| `bridge-twitch.js` | Runs in the extension context on twitch.tv, stores the captured payload. |
| `bridge-dashboard.js` | Runs on the dashboard domain, answers snapshot requests from the app. |
