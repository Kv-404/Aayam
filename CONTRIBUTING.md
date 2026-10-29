# Contributing

Aayam is open source under [AGPL-3.0-only](LICENSE). Contributions are welcome. A contribution is licensed under that same license, and the copyright notice `Copyright (C) 2026 Kv-404` stays on the project.

## Branches

- `dev` is where changes land first.
- `main` is what production deploys. [timetable.kv404.dev](https://timetable.kv404.dev) tracks `main`.
- Branch off `dev`. Open the pull request against `dev`.

Do not commit `.env`, `.env.local`, or `server/.env`. Do not commit PINs, session secrets, or database URLs.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The client is at http://localhost:5173 and the API is at http://localhost:8787. Node 24 is what `package.json` asks for.

## Checks

```bash
npm test
npm run typecheck
```

A server change that ships to Vercel needs `npm run build:api`. Commit `api/[[...path]].js`. Do not edit that file by hand. CI runs the tests and the typecheck on pull requests.

## Pull requests

- Describe what changed and how you checked it.
- Keep the diff to the task. Match the surrounding style: React function components, two-space indent.
- A UI change should say what you clicked through.
- The sheet stays read-only. Do not add a write path to Google Sheets, and do not add another database.

## Security

Report a vulnerability in private. See [SECURITY.md](SECURITY.md).
