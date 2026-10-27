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

## Install (developer mode)

1. Download `drops-hub-extension.zip` from the deployed site (or use this folder as is).
2. Unpack it somewhere permanent.
3. Open `chrome://extensions`, enable **Developer mode**.
4. Click **Load unpacked** and select the unpacked `extension` folder.
5. Open <https://www.twitch.tv/drops/campaigns> — the snapshot is captured automatically.
6. Return to the Drops Hub tab and press **Проверить снова** (or reload the page).

The zip shipped on the site is a snapshot of this folder; after changing the extension, regenerate it:

```powershell
Compress-Archive -Path extension -DestinationPath public/drops-hub-extension.zip -Force
```

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest: storage permission, content scripts for twitch.tv and the dashboard. |
| `capture.js` | Runs in the page world (`world: "MAIN"`), wraps `fetch`, forwards `ViewerDropsDashboard` payloads. |
| `bridge-twitch.js` | Runs in the extension context on twitch.tv, stores the captured payload. |
| `bridge-dashboard.js` | Runs on the dashboard domain, answers snapshot requests from the app. |
