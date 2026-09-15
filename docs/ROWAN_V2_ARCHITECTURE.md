# Rowan v2 architecture scaffold

**Status:** planning scaffold; no production behavior or database schema changed  
**Internal repository name:** Basgiath  
**Future product name:** Rowan  
**Related issue:** [#46 — automate downloading books and sync to calibre](https://github.com/ColinSnider/Basgiath/issues/46)

Implementation has begun on `codex/rowan-v2-foundation`. See [the working backend slice](v2/BUILD_STATUS.md) for actual code, checks, and remaining limits; the roadmap below is not a completion claim.

## Naming decision

The product name is changing from Basgiath to Rowan. For this planning period, keep the repository, package name, internal code identifiers, database table names, migration names, existing URLs, and historical documentation as Basgiath. New user-facing v2 copy should use Rowan behind a feature flag or centralized brand configuration. Do not perform a global string replacement: it would create noisy diffs, break deep links and storage keys, and make rollback harder.

Create a single future brand boundary, for example:

```ts
export const BRAND = {
  internalName: "Basgiath",
  productName: "Rowan",
  shortName: "Rowan",
} as const;
```

Use it only in new UI surfaces and documentation that intentionally describes the future product. Existing local-storage keys and API identifiers remain stable until a separately planned compatibility migration.

## What issue #46 means for v2

Issue #46 is titled “automate downloading books and sync to calibre,” with the body “that would be super cool if that worked.” It is a valuable idea, but it is an integration request rather than a reason to change the v2 catalog foundation immediately.

The useful part aligns with Rowan's work-first/edition-second model: a reader can select an edition, choose a local format, and keep a personal library synchronized with a tool they already use. The risky part is that automated downloading can cross into copyright, licensing, credentials, local filesystem access, and distribution. Rowan should not download books from arbitrary sources or host copyrighted files. Calibre synchronization should begin as an explicit, local, user-controlled metadata/export integration.

### Recommended issue disposition

Keep #46 open and label it `future integration` / `needs design`. Do not make it a v2 foundation milestone. Split it into later issues:

1. **Calibre metadata export** — export selected Rowan works/editions and personal shelves as a documented OPDS-compatible or Calibre-importable metadata format, with no book files.
2. **Local Calibre bridge design** — evaluate a user-run companion service or filesystem folder, authentication, network boundaries, conflict handling, and platform support.
3. **Optional file handoff** — only for files the user already owns and explicitly selects; Rowan never discovers, downloads, stores, or redistributes copyrighted content.
4. **Sync semantics** — define which side owns title, author, cover, tags, reading state, and ratings. Use dry-run previews, idempotency keys, audit logs, and conflict reports.

The v2 schema should leave room for a `user_book_integrations` table and edition/file references without adding them now:

```text
user_book_integrations
  id, user_id, provider, external_library_id, status,
  last_sync_at, cursor, settings_json, created_at, updated_at

integration_bindings
  integration_id, user_book_id, external_item_id,
  last_seen_hash, last_synced_at, conflict_state
```

These are future design placeholders, not a migration request. Keep provider records separate from Rowan's canonical work identity and personal reading truth.

## v2 architecture shape

```text
Rowan web UI (currently Basgiath repository)
          |
TanStack adapters / future versioned HTTP API
          |
Application services: catalog, library, reading, shelves,
ratings, margins, insights, archives, integrations
          |
Authorization + domain policies + transactions
          |
Drizzle repositories
          |
Railway PostgreSQL (source of truth)

Catalog providers: Open Library backbone, optional Google Books enrichment
Future integrations: Calibre bridge/export, explicitly out of initial v2
```

Keep the current React 19, TypeScript, TanStack Start/Router, Tailwind, Drizzle, PostgreSQL, and Railway deployment while the service and schema boundaries are established. Rowan is a product rename and architectural direction; it is not a reason to replace infrastructure.

## Repository scaffold to add incrementally

Do not create empty folders solely to make this tree look complete. Add a module when its contract is understood and tested.

```text
docs/
  ROWAN_V2_ARCHITECTURE.md       # this scaffold
  decisions/
    0001-name-and-integration-boundary.md
    0002-work-edition-identity.md
    0003-reading-event-semantics.md
    0004-cutover-and-rollback.md
  v2/
    data-map.md
    api-contracts.md
    metric-definitions.md
    migration-runbook.md
    ui-flows.md

shared/
  schema-v2/                      # additive Drizzle model, later
  contracts/                      # transport-safe DTOs and validators

server/
  services/                       # domain operations
  repositories/                   # persistence queries
  catalog/providers/              # Open Library, Google Books adapters
  catalog/                        # canonicalization and merge policy
  migration/                      # inventory, backfill, reconcile, report
  integrations/                   # future Calibre boundary; no downloader

src/features/
  catalog/
  library/
  reading/
  shelves/
  margins/
  ratings/
  insights/
```

TanStack server functions remain thin web adapters. A future native client should call the same services through a stable API contract; it should not import TanStack internals or database models.

## Initial scaffold milestones

### S0 — planning and boundaries

- [ ] Add this architecture scaffold and decision records.
- [ ] Centralize future Rowan branding without renaming internal Basgiath identifiers.
- [ ] Add a v2 checklist and decision log.
- [ ] Record issue #46 as a future integration, separate from catalog/reading foundations.

### S1 — domain contracts without database writes

- [ ] Define serializable DTOs for Work, Edition, UserBook, ReadingSession, ProgressEntry, Shelf, Margin, Rating, and Archive.
- [ ] Define ownership, units, date precision, status transitions, and idempotency contracts.
- [ ] Add pure canonicalization fixtures: duplicate editions, translations, adaptations, same-title/different-author cases, manual books.
- [ ] Add service interfaces with no production callers yet.

### S2 — additive schema and repositories

- [ ] Add v2 tables alongside legacy tables through reviewed SQL migrations.
- [ ] Add composite ownership checks and unique constraints.
- [ ] Add repository integration tests against an isolated PostgreSQL-compatible test database.
- [ ] Do not expose v2 tables to production users until backfill/reconciliation exists.

### S3 — migration harness

- [ ] Capture legacy rows into immutable, private source records.
- [ ] Build deterministic, resumable backfill and per-user reconciliation reports.
- [ ] Preserve every legacy metadata value, completion entry, margin, preference, and conflict.
- [ ] Test changed/deleted/reordered legacy reads during final-delta rehearsal.

### S4 — shadow services and catalog

- [ ] Resolve work-first search locally before bounded provider calls.
- [ ] Add Open Library adapter with caching, user-agent identification, timeout, rate limit, and provenance.
- [ ] Add optional Google Books enrichment behind a flag.
- [ ] Run v2 reads in shadow against a restored clone before enabling writes.

### S5 — Rowan web experience

- [ ] Add the Home Last/Current/Next model.
- [ ] Rebuild Library overview, All Books, shelves, list/grid/bookshelf parity, and book detail.
- [ ] Add reading sessions/progress history, favorites, half-star ratings, margins, series tracking, and defined insights in separate slices.
- [ ] Keep community ratings contextual and opt-in.

### S6 — cutover readiness

- [ ] Rehearse backup restore, write barrier, final delta, journal/replay, rollback, and stale-client blocking.
- [ ] Migrate a synthetic cohort, then an isolated restored account, before the girlfriend's production account.
- [ ] Enable Rowan branding only after the behavior is stable; retain Basgiath internal identifiers.

## First implementation tasks for Codex

1. Read this scaffold and `outputs/BASGIATH_V2_IMPLEMENTATION_BRIEF.md`; inspect current repository instructions.
2. Add `shared/brand.ts` (or equivalent) with Basgiath internal and Rowan display names. Change one safe, new/isolated UI label as a proof of boundary; do not rename existing storage keys.
3. Add `docs/decisions/0001-name-and-integration-boundary.md` and a v2 decision log.
4. Add `shared/contracts/v2.ts` with type-only/pure DTOs and validators; no database imports.
5. Add pure `server/catalog/canonicalize.ts` interfaces and adversarial fixtures; do not call external providers in tests.
6. Add repository/service interfaces for catalog and reading lifecycle, with placeholder implementations only where they can be tested.
7. Produce a reviewed additive migration design and data map before creating SQL.
8. Keep #46 deferred until the integration boundary, file ownership, and conflict semantics are decided.

Every task must state whether it is a pure scaffold, an additive migration, a shadow read, or a user-visible behavior change. Do not combine a brand rename, catalog identity migration, and production cutover into one change.

## Definition of ready for actual v2 implementation

- [ ] Rowan/Basgiath naming policy is documented and tested at the UI boundary.
- [ ] Work/edition identity and duplicate handling have written acceptance cases.
- [ ] Legacy source capture and backup restore are proven in an isolated environment.
- [ ] Service contracts do not depend on TanStack transport.
- [ ] New schema is additive, reviewed, and reversible before any backfill.
- [ ] Reading events distinguish real logged activity from completion-only legacy facts.
- [ ] Calibre is an optional future integration and never a hidden downloader.
- [ ] No production writes, migrations, deploys, or data changes are part of the scaffold phase.
