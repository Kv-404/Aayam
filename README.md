# Aayam · College timetable

A live college timetable at **[aayam.kv404.dev](https://aayam.kv404.dev)**. One public Google Sheet per program and batch is the single source of truth. The app reads each sheet's public Excel export and never writes back.

Students pick their batch, then their section. The week is an interactive grid and a single day is a compact list. Cancelled classes stay on the grid, struck through. Past weeks stay browsable. Faculty sign in with their college Google account and see every lecture they teach, across all batches. Everyone can subscribe to an `.ics` feed (Google, Apple, Outlook, Proton) and opt in to change alerts and lecture reminders. Admins repoint a batch at next week's sheet and post notices from `/admin`.

---

## How it runs

It runs entirely on free tiers: Cloudflare Workers Free and D1 for serving, and GitHub Actions for the heavy work.

```
 Google Sheets (public xlsx)
          │  every 5 min, or on demand
          ▼
 ┌──────────────────────────────┐        ┌──────────────────────────────────┐
 │ Sync job · GitHub Actions    │ writes │ Cloudflare D1                    │
 │ parse · detect changes ·     ├───────▶│ • timetable archive + past weeks │
 │ archive · prebuild every API │        │ • prebuilt responses (snapshots) │
 │ response · send web pushes   │        │ • faculty, admin, notices, push  │
 └──────────────▲───────────────┘        └───────────────▲──────────────────┘
                │ workflow_dispatch                      │ one lookup per request
 ┌──────────────┴────────────────────────────────────────┴──────────────────┐
 │ Cloudflare Worker · static React SPA (free, unmetered) + /api/*          │
 │ ≤ 10 ms CPU per request: look up, stitch, answer (ETag/304)              │
 └──────────────────────────────────────────────────────────────────────────┘
```

Parsing a sheet costs far more CPU than a free Worker allows. So the job does that work on GitHub's runners and stores every response the site can ask for. The Worker only serves those rows. See [`docs/agent/server.md`](docs/agent/server.md) for the full design and [`docs/agent/deploy.md`](docs/agent/deploy.md) for operations.

### Sign-in

- **Students**: no account. Pick a batch and section; it is remembered on the device. Logging out from the settings menu clears it.
- **Faculty**: Google sign-in, limited to institutional domains and checked against the faculty directory in D1. The session is an HMAC-signed, `HttpOnly` cookie.
- **Admins**: a password, stored as a keyed hash in D1. Logins are rate-limited.

## Development

```bash
npm install
npm run dev           # Worker + local D1 on :8787, sync job every 2 min, Vite on :5173
npm test              # server, sync job and Worker tests
npm run typecheck
npm run check:worker  # bundle the Worker as Cloudflare would
```

Copy `.env.example` to `.env` to point the local job at other sheets. Worker secrets for local runs go in `.dev.vars`.

## Next week's sheet

An admin pastes the new link at `/admin`. The timetable switches within about a minute, and the previous week moves to the past-weeks menu. A new sheet whose dates do not overlap the current week starts a clean change log. Details are in [`docs/agent/sheet.md`](docs/agent/sheet.md).

## Deployment

Every push to `main` is typechecked, tested, built, migrated (D1) and deployed by `.github/workflows/deploy.yml`. One-time setup (API tokens, secrets, and connecting the domain) is in [`docs/agent/deploy.md`](docs/agent/deploy.md).

## Security

This repository is public. No secrets live in it: `.env*` and `.dev.vars` are git-ignored, and production secrets are Cloudflare Worker secrets and GitHub Actions secrets. The sheets are view-only and the browser never receives a Google key. Report security issues privately, as described in [SECURITY.md](SECURITY.md).

---

## License

Aayam is free software under the [GNU Affero General Public License v3.0 only](LICENSE). You may copy it. Keep the copyright notice, `Copyright (C) 2026 Kv-404`. If you share a copy, or run a modified copy as a website, you must publish that source under the same license.

Source: [github.com/Kv-404/Aayam](https://github.com/Kv-404/Aayam)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
