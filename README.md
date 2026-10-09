# Hackathon Boilerplate — works without the internet

One computer (the **hub**) runs everything: the app, the database and a **local AI**. Phones and laptops on the same
Wi-Fi or LAN open it in a browser. No cloud services, no internet needed once it's set up.

- **api/**: NestJS (Fastify) + Prisma + PostgreSQL/pgvector
- **web/**: React + Vite + TanStack Query/Router + shadcn/ui (works in phone browsers too)
- **mobile/**: Expo + Expo Router + React Native Reusables + TanStack Query (optional)
- **AI**: [Ollama](https://ollama.com) on the hub — streaming chat, structured JSON output, "Generate with AI" example
- **RAG**: ask questions about your own documents (PDF/TXT/MD), answers with sources
- **Auth**: email + password, permission-based roles (admin, user, your own)

## Prepare the hub (needs internet, do it before the event)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), [Node.js 24](https://nodejs.org) and [Ollama](https://ollama.com/download).
2. Download the AI models:
   ```
   ollama pull qwen3.5:2b        # chat model (pick by hardware, see below)
   ollama pull embeddinggemma    # for RAG
   ```
3. Install and set up the app:
   ```
   npm run setup     # installs everything, creates api/.env with a random secret
   npm run db:up     # starts Postgres + pgvector (port 4102)
   npm run db:push   # creates the tables
   npm run db:seed   # roles, a demo admin (see api/prisma/seed.ts) and demo items
   npm run rag:ingest --prefix api   # indexes the sample handbook in api/rag-data
   ```

Which chat model (`AI_MODEL` in `api/.env`):

| Hub hardware | Model | Download |
|---|---|---|
| No GPU / small laptop | `qwen3.5:2b` | ~3 GB |
| GPU with 4–6 GB VRAM | `qwen3.5:4b` | ~3.5 GB |
| GPU with 8 GB+ VRAM | `qwen3.5:9b` | ~7 GB |

On an 8 GB RAM hub, keep Docker small: create `%UserProfile%\.wslconfig` with `[wsl2]` and `memory=2GB`, then restart Docker.

Not sure which model? Download a few and compare them on the hub itself (speed, English/Tagalog answers, JSON):

```
npm run ai:bench -- qwen3.5:4b gemma4:e4b    # results and full answers in ai-bench.md
```

With a GPU, let the AI answer several people at once: `AI_PARALLEL=2` (or 4) in `api/.env`.

## Run it for everyone (the demo)

```
npm run hub
```

It builds the web app, starts the API and prints the address to share (e.g. `http://192.168.1.20:4101`) with a QR
code. The app's Home page shows the same QR code. Every device on the same Wi-Fi/hotspot opens that address.
Turn the internet off — it keeps working.

- It starts Ollama by itself if it isn't running (with Ollama's cloud models switched off), and loads the models at startup
  so the first question doesn't wait.
- Windows: if other devices can't connect, allow Node.js in Windows Firewall (Private networks).
- The AI answers one question at a time; a GPU makes it much faster.

## Develop

```
npm run ai           # local AI (ollama serve with this project's settings) — skip if Ollama is already running
npm run dev          # web → http://localhost:4100 (also http://<your-ip>:4100)   api → http://localhost:4101/api
npm run dev:mobile   # Expo (needs `npm run dev:api` running): scan the QR code with Expo Go
```

The mobile app finds the API on the computer running Expo by itself. To use a hub instead, set
`EXPO_PUBLIC_API_URL=http://<hub-ip>:4101/api` in `mobile/.env`.

## RAG (ask your documents)

- Upload PDF/TXT/MD files on the web **Docs** page (needs `docs.manage`; admins have it), or
- put files in `api/rag-data/` and run `npm run rag:ingest --prefix api`.

Tune chunk size, number of sources and the answer prompt in `api/src/rag/rag.config.ts`. Uploading a file with the
same name replaces it. Scanned (image-only) PDFs have no text and can't be indexed. If you change
`AI_EMBEDDING_MODEL`, index the documents again.

## Expo MCP (development tool, optional)

The project enables the Expo plugin for Claude Code (skills + Expo MCP) in `.claude/settings.json`. It's for building
the app, not part of it, and needs the internet. Setup: `/mcp` → `plugin:expo:expo` → Authenticate, `npx expo login`,
open an Android emulator, `npm run dev:mobile`, then reconnect the MCP.

## Other commands

```
npm run typecheck    # checks api + web + mobile (the only "test")
npm run db:studio    # browse the data
```

Already built in: login rate limits, roles and permissions, errors shown as toasts, AI status badge.
Change or remove the seeded admin in `api/prisma/seed.ts` before real people use the hub.

AI rules live in `CLAUDE.md`.
