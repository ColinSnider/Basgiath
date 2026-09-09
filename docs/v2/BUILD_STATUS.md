# Rowan build status

## Latest: richer Rowan styling and book detail

Restored theme-aware burgundy/gold gradients, warm surfaces, display fonts, and active navigation accents. Opening a book in standalone Rowan now focuses the content on a cover-led detail view, with author, status, personal rating, progress, and grouped reading controls. Existing edit, edition, margins, and history controls remain available. Added the Rowan app directory to Tailwind source scanning. Build and TypeScript checks passed; authenticated desktop/mobile visual review remains pending.

## Dedicated Rowan pages

Standalone Rowan now has real top-level Home, Library, Search, Calendar, Insights, Goals, Margins, and Settings routes. The former `/_app` route indirection and one-page scroll behavior are removed. A persistent shell preserves pending reading mutations and open details; theme settings apply across pages. Feature queries are scoped to the visible page, and reading details are extracted into `ReadingPanel`.

The reading history editor now supports reasoned corrections and removals. Corrections append retained audit entries, preserve idempotent retries, recalculate effective progress, move calendar observations, and round-trip through archives. Progress uses explicit baseline/observation semantics for both pages and audio seconds. This adds `migrations-v2/0005_progress_corrections.sql`.

## Standalone application — September 8, 2026

Rowan has its own application entry, root/login routes, build output, session storage key, and Railway configuration. Authentication and reading data use only its dedicated database, with no automatic Basgiath import. See [standalone setup](STANDALONE_ROWAN.md). This is a staging application build, not a production cutover.

The checkpoint sections below describe earlier slices. Code now also includes insights/goals, manual books, edition controls, archive restore, account settings, and legacy synchronization for the compatibility screen. Their older “next” items are historical.

## Earlier backend checkpoint

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
- Insights, archives, source capture, and production migration/recovery remain subsequent slices. Raw legacy book metadata has a reserved storage field but no backfill has run.
- Actor IDs must be supplied by a validated server session. The service actor is not a client request field; authorization wiring is required before exposing endpoints.

## Next implementation slice

Add series and insights. Keep local storage and legacy Basgiath identifiers stable.

## Phase 2: development UI

`/rowan` supports catalog search/save, filtered library pages, list/grid views, start/pause/resume/progress/finish/DNF/reread, and reading history. Failed transport requests retain the original mutation key and payload for retry. Domain conflicts refresh server state. Rowan bypasses the legacy store provider.

To run locally, configure `DATABASE_URL` for your disposable legacy development database and `ROWAN_DATABASE_URL` for a separate development database containing the matching legacy user IDs/usernames. Existing login sessions are validated in `DATABASE_URL`; all v2 library operations use `ROWAN_DATABASE_URL`. Do not point either connection at production. Apply the existing legacy schema and `migrations-v2/0000_catalog_reading_foundation.sql` to the isolated database before enabling the screen; this code never runs migrations automatically.

Set `ROWAN_V2_ENABLED=true`, `ROWAN_V2_ENV=staging`, and `OPEN_LIBRARY_USER_AGENT` to a real application/contact identity, run `npm run dev`, sign in, then open `/rowan`. The gate requires the explicit staging marker, rejects missing configuration and matching host/port/database identities (including different credentials), and therefore works with Railway's production-mode runtime while remaining off in production unless someone explicitly marks it staging. Different DNS aliases cannot be detected; provision distinct databases deliberately. No production rollout or backfill is included.

The history view currently uses device-local dates and shows recorded observations, not a calendar or inferred daily totals. Audio input is explicitly labeled in seconds. Edition selection and the full Home redesign remain later slices.

## Phase 3: personal library organization

Implemented private shelves (create, rename, add/remove membership, filter), favorites with a library filter, and personal ratings from 0.5 to 5 stars. Clearing a rating removes it without affecting favorites or reading history. Ratings use integer half-star units in their own table; no community aggregate or public rating exposure is included.

Shelf changes and personal book changes share the actor transaction lock and durable retry receipts. Version checks reject stale edits. Composite foreign keys ensure a shelf and its books belong to the same account. Shelf removal means removing membership only; it never deletes a book. Shelf deletion and manual ordering are deferred.

Apply `migrations-v2/0001_personal_library.sql` after the initial v2 migration in the isolated development database before using this version of `/rowan`. It adds shelves, shelf items, ratings, and an owner-pair index; existing legacy rows and prior migration files are untouched. The development gate from Phase 2 still applies.

### Private book margins

Apply `migrations-v2/0002_book_margins.sql` after `0001` in the isolated database. Book details now support private text margins with an optional free-text location, editing, and confirmed deletion. All writes use owner checks, version checks, and mutation receipts. Deleted margins retain their text in the database with a deletion timestamp and are excluded from the UI. No restore UI or revision archive exists yet. Text renders as plain text; no HTML execution. New drafts clear only after their own save is confirmed, and edit drafts survive conflicts. Legacy margins are not migrated in this slice.

## Phase 4: Home reading overview

`/rowan` opens with Last / Current / Next. Last uses the most recent completed attempt (known finish dates first), including past reads of a currently reread book. Current shows up to six active/paused attempts, active first, using the attempt's progress snapshot; unknown totals stay unknown. Next shows the three most recently saved want-to-read books, not a manually ordered queue. These owner-scoped queries are independent of Library filters and pagination. Cards focus and scroll to the existing book controls; mutations refresh the overview. No new database migration is needed for Home.

## Phase 5: reading calendar

The monthly calendar groups recorded starts, observed progress, completions, and dated DNF events by device-local day. Month boundaries are sent as explicit instants, including local timezone offsets and daylight-saving changes; server queries use inclusive start/exclusive end. Baselines do not count as progress events, unknown dates remain absent, and logged positions are not presented as daily pages/minutes read. Day buttons reveal events and open the book controls. Previous/next month, current month, empty/error/loading states, and an explicit truncation notice are included. Queries are owner-scoped, limited to 32 days, and capped at 1,000 events per kind. A saved diary timezone, derived daily totals, and corrections remain deferred. No schema change is required.
