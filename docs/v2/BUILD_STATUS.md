# Basgiath v2 / Rowan — first working backend slice

Branch: `codex/rowan-v2-foundation`. Local development only.

## Implemented

- Separate `v2` PostgreSQL schema: works, editions, external mappings, user books, reading sessions, progress entries, and mutation receipts.
- Existing account IDs retained; composite foreign keys prevent an edition from being assigned to the wrong work.
- Real Drizzle services for save-to-library, list library, start, pause, resume, progress, finish, DNF, reread, and history retrieval.
- Open Library work search/lookup adapter with canonical work paths, request deduplication, bounded cache, throttling, timeouts, and optional edition enrichment. Configure a real application/contact User-Agent when wiring it to a running server.
- Known local work mappings remain usable during a provider outage.
- Per-user transaction locks, version conflicts, and durable response receipts prevent duplicate mutations/retries. Receipts are not a complete disaster-recovery journal.
- New attempts retain prior reads. Start positions are baselines; finishing does not fabricate last-day reading activity. Edition totals are snapshots.
- The older canonicalization helper now resolves provider references through trusted local mappings. A provider ID can no longer masquerade as an internal work ID.

## Running checks

`npm test` includes v1.1 and v2 regressions. `npm run test:v2` runs the catalog, provider, and isolated database tests. `npm run typecheck` and `npm run build` verify compatibility with the current app.

Tests instantiate temporary in-memory PostgreSQL (PGlite) and synthetic users; no `DATABASE_URL` is read by the v2 service or provider modules. Provider tests use injected responses, not live external calls. PGlite exercises SQL/transactions but is not a substitute for a multi-connection Railway/PostgreSQL concurrency rehearsal.

## Migration isolation

The v2 SQL is in `migrations-v2/`, generated through `drizzle.v2.config.ts`. It has only been applied to the isolated test database. The current `drizzle.config.ts` still points to legacy `migrations/`.

Actual `serve.mjs` currently runs the legacy migration folder at startup, despite the README's separate-migration guidance. Do not place experimental SQL in that folder. Production startup/migration separation must be corrected and rehearsed before any v2 activation.

The initial v2 migration's two referenced composite indexes were deliberately moved before their foreign keys; generated ordering failed a real SQL test. The snapshot reflects the same resulting schema. These files are new, unapplied experimental migrations, not edits to previously deployed migrations.

## Deliberate limits of this slice

- `/rowan` now calls these services through authenticated, development-only server functions. The legacy application remains separate.
- The UI uses owner-scoped pages of 24 books, title/author search, status filters, list/grid views, and explicit history DTOs. The original full-library method remains for internal callers.
- Provider saves accept canonical work references only. Explicit edition picking, manual entry, ISBN routing, and multi-provider merging come next. Unknown formats stay unknown.
- Author names are temporarily stored on works; normalized author/series tables are still pending.
- Current progress uses integer pages/seconds/percent. Backward/backdated corrections are rejected until a correction editor and recalculation policy exist.
- Unknown starts/finishes remain null. Date-only precision and diary timezone semantics need implementation before legacy backfill.
- One active/paused attempt per relationship is enforced for new use. Legacy duplicate/multiple-active-copy conflicts must be represented before applying this policy to migrated accounts.
- Ratings, shelves, margins, insights, archives, source capture, and production migration/recovery remain subsequent slices. Raw legacy book metadata has a reserved storage field but no backfill has run.
- Actor IDs must be supplied by a validated server session. The service actor is not a client request field; authorization wiring is required before exposing endpoints.

## Next implementation slice

Add shelf/rating/margin operations with the same owner checks and transaction rules. Keep local storage and legacy Basgiath identifiers stable.

## Phase 2: development UI

`/rowan` supports catalog search/save, filtered library pages, list/grid views, start/pause/resume/progress/finish/DNF/reread, and reading history. Failed transport requests retain the original mutation key and payload for retry. Domain conflicts refresh server state. Rowan bypasses the legacy store provider.

To run locally, configure `DATABASE_URL` for your disposable legacy development database and `ROWAN_DATABASE_URL` for a separate development database containing the matching legacy user IDs/usernames. Existing login sessions are validated in `DATABASE_URL`; all v2 library operations use `ROWAN_DATABASE_URL`. Do not point either connection at production. Apply the existing legacy schema and `migrations-v2/0000_catalog_reading_foundation.sql` to the isolated database before enabling the screen; this code never runs migrations automatically.

Set `ROWAN_V2_ENABLED=true` and `OPEN_LIBRARY_USER_AGENT` to a real application/contact identity, run `npm run dev`, sign in, then open `/rowan`. The gate rejects production mode, missing configuration, and matching host/port/database identities (including different credentials). Different DNS aliases cannot be detected; provision distinct databases deliberately. No production rollout or backfill is included.

The history view currently uses device-local dates and shows recorded observations, not a calendar or inferred daily totals. Audio input is explicitly labeled in seconds. Edition selection, shelves, half-star ratings, and the full Home redesign remain later slices.
