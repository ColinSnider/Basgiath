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

- No current routes call these services yet. The visible application remains v1.1; Rowan UI wiring is the next slice.
- Current methods use full-library reads. Pagination and stable HTTP DTO serialization precede connection to large live accounts.
- Provider saves accept canonical work references only. Explicit edition picking, manual entry, ISBN routing, and multi-provider merging come next. Unknown formats stay unknown.
- Author names are temporarily stored on works; normalized author/series tables are still pending.
- Current progress uses integer pages/seconds/percent. Backward/backdated corrections are rejected until a correction editor and recalculation policy exist.
- Unknown starts/finishes remain null. Date-only precision and diary timezone semantics need implementation before legacy backfill.
- One active/paused attempt per relationship is enforced for new use. Legacy duplicate/multiple-active-copy conflicts must be represented before applying this policy to migrated accounts.
- Ratings, shelves, margins, insights, archives, source capture, and production migration/recovery remain subsequent slices. Raw legacy book metadata has a reserved storage field but no backfill has run.
- Actor IDs must be supplied by a validated server session. The service actor is not a client request field; authorization wiring is required before exposing endpoints.

## Next implementation slice

Build the Rowan Library and Current Reading screens against these services in a dedicated local development environment, then add shelf/rating/margin operations with the same owner checks and transaction rules. Keep local storage and legacy Basgiath identifiers stable.
