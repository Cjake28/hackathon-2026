# HACKATHON MODE — speed over everything
24-hour hackathon. A working demo beats clean code.

## This project's frontend: web + mobile  ← set at kickoff: web / mobile / both
- Only build screens in the frontend(s) named above.
- Dropping one? Delete its folder (`web/` or `mobile/`) and remove it from the root `setup` and `typecheck` scripts.

## RAG (Q&A over documents): on  ← set at kickoff: on / off
- Off? Delete `api/src/rag/`, `api/src/ingest.ts`, `api/rag-data/`, the `Document` + `DocumentChunk` models,
  `RagController`/`RagService` in `app.module.ts`, the `rag:ingest` script, the Docs page/tab + nav entries,
  `hooks/useDocs.ts`, and the `docs.manage` permission.

## Stack (don't change)
- api/: NestJS (Fastify) + Prisma 7 + PostgreSQL — http://localhost:4101/api
- web/: React + Vite + TS + shadcn/ui (Radix) + TanStack Query + TanStack Router (file-based) — http://localhost:4100
- mobile/: Expo SDK 57 + Expo Router + React Native Reusables (shadcn for React Native, NativeWind) + TanStack Query
- Vite proxies `/api` → Nest (no CORS setup). Mobile calls the API directly; its URL is detected automatically.
- `npm run dev` runs api + web; `npm run dev:mobile` runs Expo. Docker runs Postgres + pgvector (4102) and Mailpit (inbox: http://localhost:4104).
- AI: Gemini via `@google/genai` (API key or Vertex AI). RAG: pgvector in the same Postgres.

## Adding a feature — copy the `items` example
1. DB: add a model in `api/prisma/schema.prisma` (IDs: `Int @id @default(autoincrement())`)
   → `npm run db:push`. No migrations.
   - If Prisma warns about data loss, stop and ask me. Don't try to bypass it.
   - Demo data goes in `api/prisma/seed.ts` → `npm run db:seed`.
2. API: copy `api/src/items/items.controller.ts` → inject `PrismaService` directly,
   put `@Can('<feature>.<action>')` on each method, then add the controller to `controllers` in `api/src/app.module.ts`.
   - No feature modules. No service by default.
   - Add `<feature>.service.ts` only if logic is shared or longer than ~50 lines (register it in `providers`).
   - Prisma types come from `@prisma/client`.
3. Data hooks: copy `hooks/useItems.ts` (in `web/src/` or `mobile/`) → useQuery for reads,
   useMutation + invalidateQueries for writes. Add the type to `types.ts`. Duplicating backend types is fine.
4. Web page: copy `web/src/routes/_app/items.tsx` → a new file in `web/src/routes/_app/` is a new logged-in page.
   Add a nav link (with its permission) to the `nav` array in `web/src/routes/_app.tsx`.
   - Dynamic params: `_app/items.$id.tsx` + `Route.useParams()`. Fetch with hooks, no route loaders.
   - Never edit `routeTree.gen.ts`. Components: `web/src/components/ui/`, add more with `npx shadcn@latest add <name>` in web/.
5. Mobile screen: copy `mobile/app/(app)/items.tsx` → a new file in `mobile/app/(app)/` is a new logged-in screen.
   Add a `<Tabs.Screen>` (with its permission) in `mobile/app/(app)/_layout.tsx`. Detail screens: `app/(app)/items/[id].tsx`.
   - Components: `mobile/components/ui/`, add more with `npx @react-native-reusables/cli@latest add <name>` in mobile/.
   - All text must be inside `<Text>` from `@/components/ui/text`. Style with Tailwind classes (`className`).

## AI (Gemini, already built)
- Every AI call goes through `api/src/ai/ai.service.ts` — inject `AiService` in any controller:
  - `ai.text(prompt, system?)` → string
  - `ai.json(prompt, zodSchema, system?)` → typed object (structured output; use this for extract/classify/generate)
  - `ai.chat(messages, system?)` → streamed text (see `ai.controller.ts`)
  - `ai.embed(texts, 'document' | 'query')` → vectors (RAG)
- Example AI feature to copy: `suggest()` in `api/src/items/items.controller.ts` + `useSuggestItems` + the
  "Generate with AI" dialog in `web/src/routes/_app/items.tsx`.
- AI endpoints: `@Can('ai.use')` + `@UseGuards(ThrottlerGuard)` (AI costs money). Never call Gemini from web/mobile.
- Streaming to the UI: `streamText()` in `lib/api.ts` (web: fetch, mobile: expo/fetch), see `hooks/useAi.ts`.
- Model and provider are set in `api/.env` (`AI_MODEL`, `GEMINI_API_KEY` or Vertex). Don't hardcode model names.
- Backup AI is automatic: when a provider fails (rate limit, error, outage) the next one answers —
  Gemini → `GEMINI_API_KEY_BACKUP` / `AI_MODEL_BACKUP` → any OpenAI-compatible API (`BACKUP_AI_*`). RAG embeddings
  only fall back to Gemini. Logs show `[ai] ... answered by backup`.
- AI SDKs (`@google/genai`, `openai`) are used only inside `ai.service.ts`. Features always go through `AiService`.
  Zod is for AI schemas, not for request validation.

## RAG (document Q&A, already built)
- Upload: web Docs page (PDF/TXT/MD) or put files in `api/rag-data/` and run `npm run rag:ingest`.
- Settings (chunk size, top-k, min score, answer prompt): `api/src/rag/rag.config.ts`.
- Flow: `rag.service.ts` → chunk → `ai.embed` → pgvector (`DocumentChunk.embedding`, raw SQL) → search → `ai.text` with numbered sources.
- Vector columns can't be written with Prisma's create; use raw SQL like `ingest()` does.

## Expo plugin (skills + MCP)
- Use the expo-* skills for correct Expo SDK 57 APIs and config, but keep this boilerplate's choices:
  React Native Reusables + lucide icons + `className` styling, JS `<Tabs>`, TanStack Query hooks in `mobile/hooks/`.
  Don't switch to @expo/ui, NativeTabs, SF Symbols or Expo Router data loaders, and don't restructure folders.
- Don't submit Expo skill feedback and don't enable telemetry.
- The Expo MCP is optional. If it isn't connected, carry on without it.
- Local Expo MCP tools (`automation_take_screenshot`, `automation_tap`, `automation_find_view`, `collect_app_logs`,
  `expo_router_sitemap`) work while `npm run dev:mobile` runs with an Android emulator open. Use them only when I ask
  to check the app or when debugging a mobile bug. Give buttons and inputs you add a `testID` so they can be tapped.

## Auth & permissions (already built, don't rebuild)
- Every API route requires login by default. `@Public()` opens a route.
- `@Can('items.delete')` requires that permission. `@CurrentUser() user: AuthUser` gives the logged-in user.
  All three come from `api/src/auth/auth.decorators.ts`.
- New permission: add it to `api/src/auth/permissions.ts` AND `types.ts` in web/mobile. Then give it to roles
  on the web Roles page or in `api/prisma/seed.ts`. The `admin` role has `*` (everything).
- Frontends: `useMe()` is the current user, `const can = useCan(); can('items.delete')` hides buttons/links/tabs
  (`hooks/useAuth.ts`). Web pages in `routes/_app/` and mobile screens in `app/(app)/` need login.
- Sessions: web uses an httpOnly cookie; mobile keeps the token in SecureStore and sends `Authorization: Bearer`.
- Sign-up: email + password → 6-digit code by email → verify screen. Google: "Continue with Google" (hidden until configured).
- Sending email: inject `MailService` and call `send(to, subject, text)`.
- Seeded admin login: see `api/prisma/seed.ts`. Emails in `ADMIN_EMAILS` (api/.env) become admin when they sign up.
- Auth endpoints are rate limited (`@UseGuards(ThrottlerGuard)` on AuthController). Add the same to any new
  public endpoint that sends email or checks a password.

## Errors are already handled globally
- API: `api/src/error.filter.ts` returns `{ statusCode, message }` for every error (missing record → 404, duplicate → 409).
- Web shows a toast, mobile shows an alert, for any failed query or mutation; a 401 sends the user to login (`lib/query.ts`).
- Don't add per-feature error handling.

## Rules
- NO TESTS. No spec files, no test libraries.
- NO DTO classes / class-validator. Use plain TS types for request bodies.
- NO PLANNING. No specs, plan docs, plan mode, brainstorming, or TDD skills. Just build.
- Don't ask questions unless truly blocked. Pick a sensible default and mention it in one line.
- Make the smallest change that works. No refactors, no abstractions. Duplication is fine.
- No new dependencies unless really needed. Mobile: install with `npx expo install <pkg>` so versions match the SDK.
- Skip logging and validation unless asked. Seed or hardcode data freely.

## Checking work (THIS ONLY)
- After a feature: `npm run typecheck` (root, checks every app), fix the errors, then stop.
- Don't run builds or exports. Don't start servers (they're already running). No browser or device checks unless asked.
- If the same error survives 2 fix attempts, stop and report.

## Replies
- Short: what changed + anything I need to do.
