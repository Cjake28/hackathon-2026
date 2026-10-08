# Hackathon Boilerplate

One API, two frontends. Pick web, mobile or both at kickoff (see the top of `CLAUDE.md`).

- **api/**: NestJS (Fastify) + Prisma + PostgreSQL
- **web/**: React + Vite + TanStack Query/Router + shadcn/ui
- **mobile/**: Expo + Expo Router + React Native Reusables + TanStack Query
- **Auth**: email + password with email OTP, Continue with Google, permission-based RBAC
- **AI**: Gemini (API key or Vertex AI) — streaming chat, structured JSON output, "Generate with AI" example
- **RAG**: ask questions about your own documents (PDF/TXT/MD), answers with sources (pgvector)

## Setup (once)

```
npm run setup     # installs everything and creates the .env files
npm run db:up     # starts Postgres + pgvector (port 4102) and Mailpit (inbox: http://localhost:4104)
npm run db:push   # creates the tables (and the pgvector extension)
npm run db:seed   # roles, a demo admin (see api/prisma/seed.ts) and demo items
```

No Docker? Put a Neon or Supabase Postgres URL in `api/.env` and skip `db:up` (both support pgvector).

## AI setup

1. Get a free key at https://aistudio.google.com/apikey and put it in `api/.env` as `GEMINI_API_KEY`.
2. Restart the API. AI Chat, Docs and "Generate with AI" (Items page) now work.

Pick the model with `AI_MODEL` in `api/.env` (`gemini-3.8-flash` by default, `gemini-3.5-flash-lite` is cheaper and faster).

**Vertex AI instead** (uses Google Cloud credits, higher limits, data not used for training): enable the Vertex AI API in
your Google Cloud project, then in `api/.env` set `GOOGLE_GENAI_USE_VERTEXAI="true"`, `GOOGLE_CLOUD_PROJECT` and
`GOOGLE_CLOUD_LOCATION`, leave `GEMINI_API_KEY` empty, and log in with `gcloud auth application-default login`
(on a server: `GOOGLE_APPLICATION_CREDENTIALS` = path to a service account JSON).

Privacy: on the free AI Studio tier Google may use prompts to improve its products. Use Vertex for sensitive data.

### Backup AI (automatic fallback)

When the AI fails (rate limit, error, outage), the next configured provider answers. All optional, in `api/.env`:

| Order | Settings | Covers |
|---|---|---|
| 1 | `GEMINI_API_KEY` (or Vertex) | Everything |
| 2 | `GEMINI_API_KEY_BACKUP` (e.g. a second Google account) and/or `AI_MODEL_BACKUP` | Everything, including RAG embeddings |
| 3 | `BACKUP_AI_API_KEY` + `BACKUP_AI_MODEL` (+ `BACKUP_AI_BASE_URL` for Groq, OpenRouter, ...) | Chat, text, JSON (not RAG embeddings) |

A provider that hits its rate limit is tried last for 60 seconds. The API log shows when a backup answered.

## RAG (ask your documents)

- Upload PDF/TXT/MD files on the web **Docs** page (needs `docs.manage`; admins have it), or
- put files in `api/rag-data/` and run `npm run rag:ingest`. A sample handbook is included.

Then ask on the Docs page (web or mobile). Tune chunk size, number of sources and the answer prompt in
`api/src/rag/rag.config.ts`. Uploading a file with the same name replaces it. Scanned (image-only) PDFs have no text
and can't be indexed.

## Run

Web:

```
npm run dev          # web → http://localhost:4100   api → http://localhost:4101/api
```

Mobile (two terminals):

```
npm run dev:api      # the API
npm run dev:mobile   # Expo: scan the QR code with Expo Go, or press "a" for an Android emulator
```

The phone must be on the same Wi-Fi as the computer. The app finds the API at `http://<computer-ip>:4101/api` by itself.
If the phone can't reach it, allow Node.js through Windows Firewall (Private networks), or set
`EXPO_PUBLIC_API_URL` in `mobile/.env`.

Sign-up codes land in Mailpit at http://localhost:4104 until real SMTP is set.

## Expo MCP (lets the AI see and tap the mobile app)

The project enables the Expo plugin for Claude Code (skills + Expo MCP) in `.claude/settings.json`.

Once per machine:

1. In Claude Code: `/mcp` → `plugin:expo:expo` → Authenticate (log in with your Expo account).
2. In a terminal: `npx expo login` with the same Expo account.
3. Android: install Android Studio and create an emulator (Device Manager). iOS simulator works on a Mac only.
   Physical phones aren't supported for the AI tools (Expo Go still works for you).

Each session:

1. Open the emulator, then `npm run dev:mobile` and press `a`. The MCP connection starts by itself
   (`EXPO_UNSTABLE_MCP_SERVER=1` in `mobile/.env`).
2. In Claude Code: `/mcp` → reconnect `plugin:expo:expo` whenever the Expo dev server starts or restarts.

## Google sign-in (optional)

1. Google Cloud Console → Google Auth Platform → **Branding**: app name + support email (no logo, or Google wants verification).
2. **Audience** → **Publish app** (In production), so any Google account can sign in, not only test users.
   The app only asks for name, email and photo, so Google doesn't require verification.
3. **Clients** → Create client → **Web application**. Authorized JavaScript origins:
   `http://localhost` and `http://localhost:4100` (add your deployed URL later). No redirect URI, no client secret.
4. Put that Web client ID in `api/.env` (`GOOGLE_CLIENT_ID`), `web/.env` (`VITE_GOOGLE_CLIENT_ID`)
   and `mobile/.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`). Restart the dev servers.

Mobile extra steps (Google sign-in does not work in Expo Go; it needs a development build):

- Android: create an OAuth client ID of type **Android** with package `com.hackathon.app` and the SHA-1 of your
  debug keystore. Nothing to copy into `.env`.
- iOS: create an OAuth client ID of type **iOS** with bundle ID `com.hackathon.app`. Put it in `mobile/.env`
  (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`) and `api/.env` (`GOOGLE_IOS_CLIENT_ID`), and in `mobile/app.json` change the plugin
  to `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<id>" }]`.
- Build: `cd mobile && npx expo run:android` (or `run:ios` on a Mac, or EAS Build).

The Google button stays hidden until it's configured.

## Real email (optional)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` in `api/.env`, then restart.
Example for Gmail: host `smtp.gmail.com`, port `465`, your Gmail address, and an App Password.
Empty `SMTP_HOST` = emails are printed in the API console.

## Before deploying

- Set `NODE_ENV=production` (turns on secure cookies, hides 500 error details, trusts the proxy for client IPs).
- Set `JWT_SECRET` to a random string of 32+ characters. The API refuses to start in production without one.
- Set `CORS_ORIGINS` only if a browser app on another domain calls the API.
- Remove or change the seeded admin in `api/prisma/seed.ts`.
- Serve over HTTPS, and add the deployed URL to the Google client's Authorized JavaScript origins.

Already built in: rate limits on the auth endpoints (10/min per IP, 5/min for ones that send email),
OTP limits (10 min, 5 tries, 60 s resend), and Google accounts only link to an existing password
account for Gmail/Workspace addresses.

## Other commands

```
npm run typecheck    # checks api + web + mobile (the only "test")
npm run db:studio    # browse the data
```

AI rules live in `CLAUDE.md`.
