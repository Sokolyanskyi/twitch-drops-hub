# Drops Hub

A web app for keeping track of Twitch Drops campaigns: every campaign in one catalogue, favourites
with a heads-up when new rewards show up, a separate tab for already claimed drops, and one-click
claiming. Works on any device — phone, tablet, TV browser.

> The interface itself is in Russian; the codebase, docs and comments are in English.

![Drops Hub interface](docs/screenshot.png)

## Features

- **Every campaign in one list** — active, upcoming and expired, with per-drop progress and rewards.
- **Favourites** — a star on each card. The favourites tab shows a counter of new rewards, an
  "N new rewards" banner and a `new` badge on the specific drops.
- **Claimed** — a dedicated tab where collected rewards are highlighted in green and never get lost
  among the rest.
- **One-click claiming** — a "Claim" button on every drop that is already earned.
- **Search and filters** — by game, campaign or reward name, plus a status filter.
- **Auto refresh** — every 90 seconds while the tab is open.
- **Browser notifications** — about new rewards in favourites.
- **Dark responsive UI** — from 320 px wide to wide desktop screens.

## What this app deliberately does not do

- **It never asks for a Twitch password.** Sign-in uses the OAuth 2.0 Device Code Flow: the app
  shows a short code, you enter it at `twitch.tv/activate`. The password stays with Twitch; the app
  only receives an OAuth token, stored in an encrypted `httpOnly` cookie.
- **It does not spoof watch time.** Twitch only credits drop progress for actual viewing. Faking it
  is botting — a Twitch Terms of Service violation that gets accounts suspended and drops revoked.
  The app takes care of everything around drops (which campaigns exist, what is already earned, what
  is ready to claim) without pretending to watch anything.

## Stack

- **Next.js 16** (App Router, Route Handlers, TypeScript)
- **Tailwind CSS 4**
- Twitch internal GraphQL (`gql.twitch.tv`) — the same API `twitch.tv` uses
- OAuth 2.0 Device Code Flow (`id.twitch.tv/oauth2/device`)
- Cookie session: AES-256-GCM, `httpOnly`, `SameSite=Lax`

## Getting started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. To preview the interface without a Twitch account, run it with demo
data:

```bash
DROPS_MOCK=1 pnpm dev
```

Production build:

```bash
pnpm build
pnpm start
```

## Environment variables

Everything is optional — the app works out of the box.

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Cookie encryption key (16+ characters). **Recommended in production.** |
| `TWITCH_CLIENT_ID` | Your own Twitch client id instead of the public Smart TV one. |
| `TWITCH_CLIENT_SECRET` | Client secret of your own Twitch application (token refresh). |
| `TWITCH_GQL_CLIENT_ID` | Client id used for `gql.twitch.tv` requests. Defaults to `TWITCH_CLIENT_ID`. |
| `DROPS_MOCK` | `1` — serve demo data without signing in. |

See `.env.example`.

## Deploying to Vercel

1. Push the repository to GitHub (or use the existing one).
2. Import it at [vercel.com/new](https://vercel.com/new) — Vercel detects Next.js, no build settings
   are needed.
3. Add the `SESSION_SECRET` environment variable (Project → Settings → Environment Variables) — any
   random string of 16+ characters — then redeploy.
4. Open the assigned domain, hit "Sign in with Twitch" and enter the code at `twitch.tv/activate`.

From the terminal:

```bash
npx vercel --prod
```

## Custom Twitch client id (optional)

By default the app uses a public client id of the Twitch Smart TV client, which supports the Device
Code Flow, so sign-in works without registering an application. To use your own:

1. [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) → **Register Your Application**.
2. Pick any category (e.g. `Website Integration`) and the `Public` client type.
3. Copy the **Client ID** into `TWITCH_CLIENT_ID`.
4. Make sure Device Code Grant Flow is enabled for the application, otherwise keep the default client
   id.

## Project structure

```
src/
  app/
    page.tsx                  — dashboard (server-side session check)
    login/page.tsx            — device code sign-in page
    api/auth/device/start     — request a device code from Twitch
    api/auth/device/poll      — poll the sign-in status
    api/auth/session          — current user / sign out
    api/drops                 — campaign list
    api/drops/claim           — claim a drop
  components/
    Dashboard.tsx             — tabs, filters, favourites, notifications
    CampaignCard.tsx          — campaign card and drop rows
    LoginPanel.tsx            — Device Code Flow UI
  lib/
    twitch.ts                 — OAuth, Helix, GraphQL transport
    drops.ts                  — campaign and claim queries, normalization
    session.ts / seal.ts      — encrypted cookie session
    types.ts / format.ts      — types and formatting helpers
    mock.ts                   — demo data for DROPS_MOCK=1
```

## How it works

1. `POST /api/auth/device/start` asks Twitch for a device code and stores the `device_code` in an
   encrypted cookie.
2. The sign-in page polls `/api/auth/device/poll` until the code is confirmed at
   `twitch.tv/activate`; the token is then saved into the encrypted session.
3. `GET /api/drops` sends the `ViewerDropsDashboard` query to Twitch GraphQL — first as a persisted
   query (like the website), then as plain query text if the hash is unknown.
4. The frontend normalizes campaigns, computes progress and keeps favourites plus "seen" drops in
   `localStorage`.
5. `POST /api/drops/claim` calls the `DropsPage_ClaimDropRewards` mutation.

## Known limitations

- Twitch does not document the Drops campaigns API: the internal GraphQL API is used. If the schema
  changes, the queries in `src/lib/drops.ts` have to be updated.
- Favourites and "seen" marks live in `localStorage`, so each device keeps its own lists. Sign-in is
  still shared through the device code.
- The token refreshes automatically as long as Twitch returns a refresh token; otherwise sign in
  again.
