# Arcanus Practice

Arcanus Practice (**AP**) is a local-first practice management desktop app. It runs
as a double-click Electron application with an embedded Node/Express backend and a
local SQLite database — no terminal and no remote services are required to use it.

## Local-first data

All application data lives in a single `data/` folder at the project root, so the
install is fully self-contained and portable:

```
data/
  arcanus.db        # SQLite application database
  auth.db           # local auth database
  uploads/          # uploaded documents
```

You can override the location with the `DATA_DIR` environment variable (the
packaged app points it at a folder next to the executable).

## Running the desktop app

Packaged builds launch by double-clicking the installed application — no terminal
needed. To build the installers locally:

```bash
pnpm install
pnpm run dist        # build installer for the current OS (release/)
pnpm run dist:dir    # unpacked build for quick testing
```

To run the desktop shell against the current source without packaging:

```bash
pnpm run desktop     # builds the frontend, then launches Electron
```

## Development

```bash
pnpm install
pnpm run dev:all     # backend on :3003 + Vite frontend on :3002
```

## Optional API integrations

Arcanus Practice works fully offline. External integrations activate **only when
their credentials are configured**, and degrade gracefully otherwise:

- **HMRC** — set `HMRC_API_BASE_URL` / `HMRC_AUTH_URL` and per-tenant credentials.
- **Companies House** — set `COMPANIES_HOUSE_API_KEY`.
- **Email** — configure SMTP settings in the app's Settings page.

See `backend/.env.example` for the full list of supported variables.
