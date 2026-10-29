# Timetable

A live college timetable application. One public Google Sheet per cohort/program is the single source of truth for class schedules. The app reads spreadsheets via public Excel export and never writes back.

Students pick a cohort once. The week is an interactive grid, and a single day is a compact list. Custom themes recolour subjects, with dark/light modes and accessibility contrast toggles. The header supports exporting or syncing the current week with Google Calendar, Apple Calendar, Outlook, or Proton, as well as offline `.ics` downloads.

---

## Architecture & Authentication

The application features a modern multi-tier architecture designed for speed, security, and low operational overhead:

```
┌────────────────────────────────────────────────────────┐
│             Vite + React Client (Tailwind)             │
│   • Responsive Day/Week Grid  • Preferences & Themes   │
│   • <CodeSlots /> PIN Entry   • Google Identity Auth   │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       /api/pin-verify            /api/auth/google
                │                        │
┌───────────────▼────────────────────────▼───────────────┐
│               Express API / Vercel Serverless          │
│   • Google Sheet Parser        • Change Detection      │
│   • HMAC-SHA256 Sessions       • SQLite Memory/Disk    │
└───────┬────────────────────────┬───────────────┬───────┘
        │                        │               │
        ▼                        ▼               ▼
┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Google Sheets   │    │ Neon PostgreSQL │    │   Vercel Blob   │
│  (Read-only xlsx)│    │ • batch_codes   │    │  (State Archive │
│  Public Export   │    │ • faculty_dir   │    │   Persistence)  │
└──────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1. Student Batch PIN Access
- **6-digit PIN Entry**: Students enter a 6-digit access code via the `<CodeSlots />` component during setup.
- **Neon PostgreSQL Verification**: Verification runs on `/api/auth/pin-verify`, checking against the `batch_access_codes` table (`course`, `batch`, `pin`).
- **Batch Scoping**: A valid PIN returns the student's authorized course and batch (e.g., BTech `2025-29`), saving it to `timetable-student-batch`. The cohort picker is strictly restricted to cohorts within that batch, preventing unauthorized cross-batch visibility.

### 2. Teacher & Faculty Sign-In
- **Google OAuth**: Faculty authenticate via Google One Tap / Sign-In.
- **Authorized Domain Restrictions**: Tokens are verified on `/api/auth/google`. Only institutional email addresses from authorized domains (`@itm.edu`, `@isu.ac.in`, configured via `ALLOWED_EMAIL_DOMAINS`) are permitted.
- **Directory Authorization**: The verified email is checked against Neon PostgreSQL's `faculty_directory` table (`email`, `faculty_name`, `can_see_all_faculty`, `is_active`).
- **Secure Sessions**: Authenticated faculty receive a tamper-proof HMAC-SHA256 session token delivered in an `HttpOnly; SameSite=Lax; Secure` cookie (`timetable_faculty_session`), supporting per-faculty views or all-faculty administrative access.

### 3. Student Logout & State Reset
- **Settings Menu Logout**: Students can log out anytime via the settings (Appearance & Preferences) menu.
- **Clean State Reset**: Logging out invokes `clearStudentAuth()`, which purges `timetable-student-batch`, `timetable-unlocked-batches`, `timetable-cohort`, `timetable-role`, and `timetable-setup` from `localStorage`.
- **URL Sanitization**: Cleans the browser URL back to root `/` (removing any active `?cohort=...` query parameters) and returns the interface to a fresh onboarding state.

---

## Security Precautions for Public GitHub Repository

Because this repository is public, strict security boundaries are enforced:

- **No Secrets Committed**:
  - `.env` and `.env.*` files are explicitly excluded in `.gitignore`.
  - Database connection strings, OAuth client secrets, and session signing keys must NEVER be committed to version control.
- **Safe Placeholders in `.env.example`**:
  - The committed `.env.example` file contains only safe dummy placeholders (e.g. `your_google_sheet_id_or_url`, `user:password@ep-xyz-pooler...`, `example.edu`).
- **Read-Only Google Sheets**:
  - The timetable source sheets are shared as "Anyone with the link can view".
  - The server only downloads the public Excel export (`/export?format=xlsx`).
  - No Google service account private keys or API write keys are used or exposed to the client.
- **HttpOnly Cookies & Timing-Safe Verification**:
  - Faculty session cookies cannot be accessed via JavaScript (`HttpOnly`), preventing token leakage through XSS.
  - HMAC signatures are compared using `crypto.timingSafeEqual` to eliminate timing attack vectors.

---

## Commands

```bash
# Install all workspace dependencies
npm install

# Start local development servers
# Client runs on http://localhost:5173, Express API runs on http://localhost:8787 (API calls proxied)
npm run dev

# Run server unit test suite
npm test

# Run TypeScript compiler checks across server and client workspaces
npm run typecheck

# Build client production assets and bundle the Vercel API function
npm run build

# Run the compiled client and API server together in production mode
npm start
```

---

## Environment Variables

Copy `.env.example` to `.env` to configure your local development environment:

```bash
cp .env.example .env
```

| Variable | Default / Example | Purpose |
| --- | --- | --- |
| `SPREADSHEET_BTECH_2026_30` | `your_google_sheet_id_or_url` | Google Sheet ID or URL for BTech 2026-30 |
| `SPREADSHEET_BTECH_2025_29` | `your_google_sheet_id_or_url` | Google Sheet ID or URL for BTech 2025-29 |
| `SPREADSHEET_BTECH_2024_28` | `your_google_sheet_id_or_url` | Google Sheet ID or URL for BTech 2024-28 |
| `SPREADSHEET_BTECH_2023_27` | `your_google_sheet_id_or_url` | Google Sheet ID or URL for BTech 2023-27 |
| `SPREADSHEET_MCA_2026_28` | `your_google_sheet_id_or_url` | Google Sheet ID or URL for MCA 2026-28 |
| `SPREADSHEET_IDS` | `https://...` | Comma-separated list of additional sheet URLs/IDs |
| `SPREADSHEET_ID` | `your_google_sheet_id_or_url` | Single sheet fallback for single-batch deployments |
| `DATABASE_URL` | `postgresql://user:pass@ep-xyz...` | Neon PostgreSQL connection string (auth & durable archive) |
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | Google OAuth Client ID for faculty authentication |
| `VITE_GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | Frontend Google Client ID mirror |
| `GOOGLE_CLIENT_SECRET` | *(secret)* | Google OAuth Client Secret |
| `AUTH_SECRET` | *(random 32+ hex string)* | Secret key used to sign HMAC session tokens |
| `ALLOWED_EMAIL_DOMAINS` | `itm.edu,isu.ac.in` | Authorized email domains for faculty sign-in |
| `SYNC_INTERVAL_SECONDS` | `45` | How often the background worker re-fetches the sheets |
| `HIGHLIGHT_HOURS` | `72` | Duration that inferred edits remain highlighted |
| `TIMEZONE` | `Asia/Kolkata` | Local campus timezone for clock and date calculations |
| `DATE_ORDER` | `DMY` | Interpretation of numeric dates in the sheet |
| `DATABASE_PATH` | `./data/timetable.sqlite` | Path to local SQLite database for change diffing |
| `BLOB_READ_WRITE_TOKEN` | *(optional)* | Vercel Blob read/write token for durable archive storage |

---

## Next Week’s Sheet Rollover

1. Update the appropriate `SPREADSHEET_<BATCH>` or `SPREADSHEET_ID` variable in `.env` (or Vercel project environment).
2. For local dev, delete `server/data/timetable.sqlite` and restart `npm run dev`.
3. When the dates of a newly synced sheet do not overlap with the saved week, the system automatically establishes a clean baseline: prior week changes are archived and no false additions or removals are triggered.

---

## Deployment

The project is optimized for deployment on Vercel:

1. **Client Build**: Vercel compiles the Vite client into `dist/`.
2. **Serverless API**: The API endpoint `api/[[...path]].js` is bundled via `npm run build:api`. This bundle is committed to the repository because Vercel requires function manifests prior to the build phase.
3. **Database & Storage**: On Vercel, SQLite runs in `/tmp/timetable.sqlite`. State survives cold starts and restarts through Neon PostgreSQL (`timetable_archive` table) or Vercel Blob.
4. Production deploys trigger automatically from commits to the `main` branch. Day-to-day work lands on `dev`. Live site: [https://timetable.kv404.dev](https://timetable.kv404.dev).

---

## License

Aayam is free software under the [GNU Affero General Public License v3.0 only](LICENSE). You may copy it. Keep the copyright notice, `Copyright (C) 2026 Kv-404`. If you share a copy, or run a modified copy as a website, you must publish that source under the same license.

Source: [github.com/Kv-404/Aayam](https://github.com/Kv-404/Aayam)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues privately, as described in [SECURITY.md](SECURITY.md).
