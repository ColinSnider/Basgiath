# Basgiath v2 — Master Implementation Brief

**Prepared:** September 5, 2026  
**Repository:** `/Users/colinsnider/Documents/GitHub/Basgiath`  
**Inspected revision:** `ef5360e5da78e093f38bedc24349f575a79433b0`  
**Purpose:** A complete starting specification for Codex to rebuild the web experience and backend safely.  
**Scope:** Web, data model, catalog, services, migration, quality, and operations. Native iOS is explicitly deferred.

## 0. How to use this brief

### Current implementation checkpoint — September 16, 2026

Use [the current refinement report](../docs/v2/REFINEMENT_STATUS.md) for implemented features, verification and remaining deployment work. The original unchecked lists below are historical acceptance criteria, not a list of features to rebuild. Latest code refinements cover full shelf membership, direct Series/Queue/Shelves tabs, mobile filters and active-filter chips, goal progress and editing, all-time insights, calendar margins and bounded book selection. Home remains unchanged. Railway recovery verification, native iOS, offline sync and public API work are not claimed complete.

### Current scope decision — September 12, 2026

This decision supersedes the larger original scope below wherever they conflict. Rowan is a personal reading app for the current users. The remaining book record, history, and catalog work should be modest improvements to the working app, not another rebuild.

- **Home:** preserve the accepted layout. The later September 12 clarification removes the per-book quick-action toggles and the redundant Continue reading link; the book itself remains clickable. No further redesign or dashboard expansion is planned.
- **Book record:** make the user's saved book clear and reliable: personal title/author/cover corrections, format and length, current progress, margins, and reading history. Improve confusing labels and controls within the current layout. A uniform canonical record across users is no longer a product requirement.
- **History:** prioritize a readable sequence of reading attempts, progress, and timed sessions; clear dates and unknown-date states; modest corrections of mistakes; and accurate reread/completion summaries. Preserve imported history without inventing sessions or dates. Reuse existing correction flows instead of building another history system.
- **Catalog and editions:** keep search, manual entry, personal metadata correction, and basic format/length controls dependable. Retain useful provider/ISBN information already available. Defer an extensive edition browser, cross-user catalog normalization, canonical merge tooling, and broad enrichment unless a concrete problem requires them. Changing a preferred format or length must not rewrite earlier reading attempts.
- **Preserve the foundation:** keep ownership isolation, save retries, backups, and existing identifiers/links working. Reduced product scope does not call for destructive schema cleanup or discarding data.
- **Previously removed scope stays removed:** ratings, tags, and community/social features are not pending work. Historical references to those features below are archival, not instructions to reintroduce them.

Remaining acceptance for this area: a user can understand their book record, correct its basic details, inspect and correct their reading history, and trust that old attempts and margins remain intact. No Home redesign or global catalog consistency project is needed to meet that goal.

Read this document before implementation. Inspect the current repository and any applicable `AGENTS.md` instructions again: the checkout may have changed since this audit. Treat the repository inventory below as a verified snapshot, and the v2 sections as proposed implementation requirements. SQL and TypeScript examples describe contracts and invariants; they are not ready-to-run production migrations.

This document was requested as a planning deliverable. Its creation did not authorize or perform production access, backups, migrations, deployments, account changes, or destructive operations. A later implementation task should proceed autonomously on local code, fixtures, isolated databases, tests, and reviewable changes within its authorized scope. Obtain any necessary production access and cutover authorization only after the relevant artifacts and checks are ready.

Use the milestones and commit sequence near the end. Maintain a progress checklist, decision log, migration evidence, and explicit unresolved issues. Do not attempt the entire rewrite in one commit. Stop a rollout at a failed data-safety gate; continue independent local work where possible.

### Evidence labels

- **Verified:** observed in the local source at the revision above.
- **Product requirement:** requested in the current task or supported by the earlier product discussion.
- **Proposed default:** an implementation choice recommended here; change it with a documented reason and tests.
- **Unknown:** requires a production inventory, user decision, or execution that this documentation task did not perform.

The earlier conversation, “Plan App Improvements,” was retrieved for context. Its examples and earlier assistant suggestions are background, not independent authorization. In particular, example community counts, book statistics, and series completion figures were illustrative, not real Basgiath data. Competitor observations are design inspiration, not a current market audit.

## 1. Product purpose and priorities

Basgiath began as the book app the user's girlfriend wanted. It grew through Lovable, Replit, and Codex into a working personal reading companion. The user is open to substantial UI and backend changes. The overriding concern is preserving the girlfriend's real production library and reading memories.

The goal is the best focused reading companion for its intended purpose, not the largest feature set or a new social platform.

> Help someone decide what to read, track what they are reading, remember what they read, and understand their reading life.

The central lifecycle is:

**Find → Save → Read → Remember → Browse**

- **Find:** Search for the book, without choosing among hundreds of superficially identical editions.
- **Save:** Add it to the personal library, TBR, or a shelf in one clear action.
- **Read:** Start, pause, resume, update progress, finish, and reread with minimal bookkeeping.
- **Remember:** Preserve ratings, favorite status, notes, quotes, dates, and rereads.
- **Browse:** Enjoy walking through a personal library, with excellent search and organization when needed.

### Priority order when requirements compete

1. Preserve user data and prevent cross-user access.
2. Make book identity and reading history correct.
3. Make daily reading actions simple and dependable.
4. Make the personal library beautiful and useful.
5. Add insights and contextual aggregate community information.
6. Prepare clean interfaces for future clients.

Visual polish cannot justify losing personal history. A provider match cannot justify rewriting a reader's notes or preferred title. A complete-looking chart cannot justify inventing activity.

### Product principles

- One ordinary work should look like one book throughout the app.
- Editions are available when relevant, not a mandatory first decision.
- A personal library includes saved/read books; membership does not imply physical ownership.
- Reading status, shelves, ownership, format, favorites, and rating are separate concepts.
- Organization should feel personal, not administrative.
- Existing personalization is valuable. Preserve themes, fonts, and dashboard preferences or provide a deliberate compatibility mapping.
- Insights should arise from normal use. Logging must not become homework.
- Margins are a signature feature: the app remembers what reading meant to someone.
- Community is contextual, not a destination.
- Empty, uncertain, and unavailable states should be honest.

### Non-goals for this rebuild

- Native iOS, SwiftUI, React Native, widgets, barcode scanning, camera quote capture, App Intents, and mobile offline synchronization.
- A social feed, followers, messaging, comments, book clubs, influencers, or engagement ranking.
- A recommendation engine or endless discovery feed.
- A global catalog imported in bulk just to launch v2.
- Replacing Railway, PostgreSQL, or the whole frontend stack without evidence of necessity.
- Microservices, Kubernetes, a separate search cluster, or an elaborate event platform at this scale.
- DRM, ebook storage, reading copyrighted book content, or ebook purchasing.
- A public review platform or public profiles in the initial release.
- Requiring users to correct bibliographic records before they can save a book.
- Simultaneously replacing authentication and migrating every domain concept.

## 2. Verified repository baseline

### Stack and operational shape

`package.json` declares React `^19.2.0`, TypeScript `^5.8.3`, TanStack Start `^1.167.50`, Router `^1.168.25`, Tailwind `^4.2.1`, Drizzle ORM `^0.45.2`, and `pg ^8.20.0`. These are declaration ranges, not a statement about a future install. The lockfile governs reproducible installs. Node is declared `>=22.12.0`.

Keep the stack initially. TanStack server functions can remain web adapters while business logic moves into reusable server services.

| Area | Verified files | Significance |
|---|---|---|
| Schema | `shared/schema.ts` | Users, auth sessions, user-owned books, margins, goals, user settings |
| Database | `server/db.ts`, `drizzle.config.ts` | Existing PostgreSQL/Drizzle connection and migration configuration |
| Migrations | `migrations/0000_initial_schema.sql`, `0001_drop_replit_columns.sql`, `0002_book_metadata.sql`, `meta/_journal.json` | Inspect ledger consistency before adding migrations; do not rewrite applied files |
| Data operations | `src/lib/data-fns.ts` | TanStack server functions, validation, persistence, import |
| Client state | `src/lib/basgiath-store.tsx`, `store-load-state.ts` | Current data loading, mutations, local preferences |
| Catalog | `src/lib/open-library.ts`, `src/components/BookSearch.tsx` | Existing work/edition lookup and selection flow |
| Auth | `src/lib/auth-fns.ts`, `auth-context.tsx`, `session-auth.js`, `auth-signup.ts`, `AUTH_FLOW.md` | Username/password and session model; guest behavior |
| Home | `src/routes/index.tsx` | Dashboard and current reading |
| Library | `src/routes/library.tsx` | Status browsing, history, list/bookshelf presentation |
| Book detail | `src/routes/book.$id.tsx` | Progress, completion history, metadata rating/tags, edition interaction |
| Margins | `src/routes/margins.tsx` | Notes and quotes |
| Goals / account | `src/routes/goals.tsx`, `profile.tsx`, `settings.tsx` | Statistics, settings, JSON export/import |
| Navigation | `AppHeader.tsx`, `BottomNav.tsx`, `DesktopSidebar.tsx` under `src/components` | Adapt together to coherent navigation |
| Presentation | `src/components/BookCover.tsx`, `src/components/ui/*`, `src/styles.css` | Reusable cover fallback, primitives, theme infrastructure |
| Errors | `src/lib/error-capture.ts`, `error-page.ts` | Existing starting points for error reporting |
| Deployment | `railway.json`, `serve.mjs`, `src/server.ts`, `server/index.ts` | Verify actual build/start path rather than assuming every server file is active |

The README documents Railway PostgreSQL and separate migration execution, with `/healthz` and `/readyz` health checks. Actual deployed versions, database contents, backup coverage, monitoring, and account counts were not inspected.

### Current data model

`books` contains a text ID, user ID, title, author, cover URL, format, total/current pages, total/current minutes, status, added timestamp, `reads: { finishedAt: string }[]`, and arbitrary JSON `metadata`.

The current status values validated by imports and mutations are `reading`, `finished`, `wishlist`, and `dnf`. Format is `book` or `audiobook`; do not infer that every `book` is a physical edition.

`margins` belong to a user and a specific legacy book, with note/quote type, text, optional page, and creation timestamp. Deleting the parent book cascades to margins.

`goals` store metric, target, timeframe, and creation timestamp. `user_settings` stores dark mode, accent color, compact mode, and font scale. Additional UI preferences exist outside this table; inspect the preference helpers and browser persistence before defining a complete backup.

### Verified issues that affect implementation

1. **JSON import loses book metadata.** The export includes book objects, but `importedBookSchema` in `src/lib/data-fns.ts` omits `metadata`, and the import insert mapping omits it too. The normal add/update paths do accept metadata. Fix both validation and persistence. This threatens ratings, tags, provider identity, and any unknown metadata keys.
2. **Several mutations lack ownership filters.** `updateBook`, `removeBook`, `removeMargin`, and `removeGoal` validate a session but mutate by resource ID alone. `addMargin` does not first verify ownership of the supplied book. This is a verified code defect, not evidence of exploitation. Fix immediately with negative two-user tests.
3. **Import replaces data.** `importUserData` deletes the current user's margins, goals, and books inside a transaction before inserting the supplied payload. Transactionality helps, but replacement must remain explicit and previewed; do not use it as a casual production test.
4. **Settings update assumes a row exists.** Import/settings write paths update rather than reliably upserting missing settings rows. A restore must not quietly omit settings.
5. **Legacy analytics infer more than the data supports.** Home's “Reading Sessions” counts distinct completion dates. Goals use `addedAt` as an elapsed-time start in some calculations and attribute full book lengths to completion dates. These are not logged daily reading activity.
6. **Audiobook unit mismatch needs a regression fix.** Book detail labels some progress inputs as hours while saving fields measured in minutes. Preserve existing raw data; do not multiply every historic value based on a UI suspicion.
7. **History view inconsistency exists.** The Past Reads bookshelf branch uses `allBooks`, while list history applies completion/year filtering. All v2 views must share one result set.
8. **Legacy provider provenance is ambiguous.** Manual entries can be marked `source: "openlibrary"`; edition selection preserves a work key while replacing the source URL with an edition URL, without consistently persisting a separate edition ID. Missing keys can be synthesized from titles. Validate IDs and URL kinds before treating metadata as authoritative identity evidence. Store truthful manual provenance prospectively and preserve historical raw values.
9. **Completion writes can race.** The store's `finishRead` dispatches an unawaited mutation inside a state setter and replaces the full reads array. New lifecycle operations must be awaited, atomic, and idempotent. Audiobook reread reset also needs coverage: the existing detail action resets pages without equivalently resetting minutes.
10. **Preference version handling needs hardening.** `src/lib/user-preferences.ts` normalizes imports without meaningful version dispatch and can discard unknown preference fields. Existing exports include browser preferences; introduce explicit readers for their actual shape, reject unsupported future versions before writing, and retain original input for recovery.

Do not hide these issues behind the rewrite. Small corrective patches should precede or accompany v2 scaffolding.

## 3. Task zero: protect the production data

### Safety invariant

The existing production data is the historical authority. Migration tooling may read it and write separate v2 structures; it must not destructively transform the only copy.

This does **not** mean freezing normal v1 use throughout development. The live app can continue receiving legitimate user writes until a planned cutover barrier. Use a consistent clone for development and account for subsequent changes before switching traffic.

### Required backup layers

- [ ] Correct and test the portable JSON export/import path, including unknown metadata.
- [ ] Capture a consistent PostgreSQL backup with the supported toolchain for the deployed server version.
- [ ] Record database/server version, source environment identity, snapshot time, application revision, schema migration ledger, and backup checksum.
- [ ] Store the database backup securely outside the source repository and outside the production database's failure domain.
- [ ] Restore it into a genuinely isolated PostgreSQL instance and verify both SQL integrity and application-level reads.
- [ ] Capture relevant browser-only preferences from the girlfriend's actual browser/profile with an explicit export workflow; a server dump cannot contain browser local storage.
- [ ] Create per-user reconciliation manifests for books, margins, reads, settings, and goals.
- [ ] Record restoration duration and a written restoration procedure that another person can follow.

A checksum proves file identity, not restorability. A successful dump command is not a restore drill. JSON is a personal-data portability backup, not a substitute for the database backup. Database archives include sensitive account material; never put password hashes or sessions into user-facing JSON exports.

Proposed dump format: a custom PostgreSQL archive, restored into an empty isolated target. Resolve credentials through existing protected environment mechanisms. Do not place passwords in shell history, logs, filenames, commits, or this document. Verify source and destination identities before running any restore. Never copy production sessions into an internet-accessible staging app without disabling/invalidation controls.

### Fix the metadata round trip

At minimum, add validated JSON-object metadata with `{}` as the legacy default to the import book contract, and write it in the insert mapping. Preserve arbitrary nested JSON values; do not restrict the backup to the keys currently understood by the UI.

```ts
// Illustrative: implement with the project's selected JSON-safe validator.
const importedBookSchema = z.object({
  // existing fields
  metadata: jsonObjectSchema.default({}),
});

// Within the transactional insert mapping:
metadata: book.metadata,
```

Do not use this narrow patch as a reason to change rating semantics or canonicalize books during restoration. Round-trip repair and domain migration are separate transformations.

Required fixtures include nested unknown keys, nulls, empty arrays, tags, half-star values, Open Library work and edition IDs, manual books, audiobooks, rereads, special characters, absent metadata in old exports, and very long margin text.

### Portable archive contract

Introduce an explicitly dispatched versioned envelope without breaking existing v1 exports or older files with no version marker. Inspect the current exported shape before writing its compatibility reader:

```ts
type UserArchive = {
  format: "basgiath-user-archive";
  version: number;
  exportedAt: string; // UTC ISO instant
  sourceAppVersion: string;
  data: {
    books: unknown[]; // version-specific validated contract
    margins: unknown[];
    goals: unknown[];
    settings: Record<string, unknown>;
    uiPreferences?: Record<string, unknown>;
  };
};
```

V2 adds the relevant user-book relationships, session history, progress events, ratings, shelves, favorites, and sufficient catalog snapshots to restore without providers. Imported catalog records must be reconciled through the service layer, not trusted to overwrite shared records.

- Version detection accepts legacy files and maps them explicitly.
- Validation occurs before any deletion or insertion.
- Preview shows additions, conflicts, replacements, unsupported fields, and counts.
- Default ordinary import behavior should be merge/add; full replacement requires a distinct operation and clear consequences.
- Preserve input IDs through scoped import mappings, while remapping collisions safely. Never attach a margin to another user's record because IDs happen to match.
- Duplicate source IDs and missing references produce actionable errors before writes.
- All database writes are atomic. Fault injection halfway through leaves the original database intact.
- Browser preferences cannot share a database transaction: apply them after committed import, retain the old local preference snapshot, and report/retry preference failures separately.
- Archive parsing has size and nesting limits with explicit errors, not silent truncation.
- Imported owner IDs, roles, and session IDs are never trusted.
- Complete export requires successfully loaded data; a failed load must not be exported as a falsely empty library.
- Export should eventually read a consistent server-side snapshot rather than relying solely on possibly stale optimistic client state.

### Ownership repairs

Derive the actor from a validated session and include ownership in every private-resource query. Verify owned parent records before creating children. Return a safe not-found response for absent or inaccessible IDs.

```ts
const actor = await requireActor(request);
await tx.update(books)
  .set(validatedPatch)
  .where(and(eq(books.id, id), eq(books.userId, actor.userId)));
// Verify affected-row expectations. Never trust a userId in request data.
```

Apply the same rule to all future shelves, ratings, margins, progress, imports, and exports. Public catalog access does not imply public personal-library access.

### Task-zero acceptance gate

- [ ] Export → isolated import → export preserves all supported semantic values and unknown metadata, allowing only documented ID remaps and timestamp representation equivalence.
- [ ] Failed import preserves the pre-import database.
- [ ] Missing settings rows restore correctly.
- [ ] Another user's IDs cannot be read or mutated through private operations.
- [ ] Book deletion consequences for margins are explicit and tested.
- [ ] Full backup restoration succeeds and its evidence is recorded before production schema migration begins.

## 4. Target architecture

Use a modular monolith on the existing stack:

```text
React / TanStack web
        |
TanStack server-function adapters     Future HTTP/native adapter
        |                                      |
        +----------- application services -----+
                          |
          authorization + domain policies
                          |
               Drizzle repositories
                          |
                    PostgreSQL

Catalog services ---- provider adapters / cache / enrichment jobs
```

Service functions accept an authenticated actor and validated domain inputs, not React state or raw HTTP objects. Repositories handle persistence. Shared contracts contain serializable DTOs and validation. Keep database imports, provider credentials, and server-only code out of client bundles.

Proposed service boundaries:

- Catalog search, resolution, enrichment, merge/unmerge.
- Personal library membership, metadata overrides, favorites, archive/removal.
- Reading lifecycle and progress.
- Shelves and ordering.
- Ratings and community aggregation.
- Margins and export.
- Goals and insights.
- Account data import/export.
- Migration/reconciliation administration.

Avoid a generic CRUD API that permits arbitrary patches to every database column. Model meaningful operations such as `startReading`, `recordProgress`, `finishReading`, and `changeEdition` with transaction boundaries and explicit invariants.

## 5. V2 domain model

### Core distinction

**A work is the reader-facing book. An edition describes a published version of that book. A user book is one person's relationship with the work.**

Provider identifiers are evidence, not internal primary keys. Use stable Basgiath IDs. Keep existing user IDs during this rebuild; there is no need to migrate account identity to normalize books.

Proposed naming: use a separate PostgreSQL schema such as `v2` for new tables, or a consistent `v2_` prefix if that better fits the current tooling. Logical names below omit the namespace. Never silently point legacy code at new tables with different semantics.

### Catalog tables

| Table | Principal columns | Rules |
|---|---|---|
| `works` | `id`, `title`, `subtitle?`, `description?`, `originalLanguage?`, `firstPublishedYear?`, `defaultCoverUrl?`, `catalogState`, `createdAt`, `updatedAt`, `version` | Shared bibliographic identity; no personal progress/rating; catalogState distinguishes provisional/verified/merged |
| `work_titles` | `id`, `workId`, `title`, `language?`, `kind`, `provenanceId?` | Alternate/regional titles for matching and display; retain original text |
| `editions` | `id`, `workId`, `title?`, `publisher?`, `publishedDateText?`, `language?`, `format`, `pageCount?`, `durationSeconds?`, `coverUrl?`, timestamps | Belongs to one work; unknown edition properties remain null |
| `edition_identifiers` | `id`, `editionId`, `scheme`, `normalizedValue`, `rawValue`, `source`, `confidence` | ISBN is edition evidence; index normalized identifiers; conflicting associations are reviewed |
| `authors` | `id`, `displayName`, `sortName?`, timestamps | Do not merge people by name alone |
| `work_authors` | `workId`, `authorId`, `role`, `position` | Many contributors, ordered; distinguish author/editor/etc. |
| `edition_contributors` | `editionId`, `authorId`, `role`, `position` | Narrators/translators can vary by edition |
| `series` | `id`, `name`, `description?`, `completionState`, timestamps | Unknown/open/complete, with provenance; do not invent a final number of books |
| `series_works` | `seriesId`, `workId`, `sequenceLabel?`, `sortOrder`, `isPrimary`, `isOptional`, provenance | Supports prequels, 0.5 entries, companion works, and multiple series |
| `external_mappings` | `id`, `provider`, `entityKind`, `externalId`, typed target reference, `confidence`, timestamps | Unique `(provider, entityKind, externalId)`; target must exist |
| `catalog_provenance` | `id`, target, `field`, `provider`, source reference, `fetchedAt`, `confidence`, `isLocked` | Track selected field evidence and deliberate curation |
| `catalog_merge_events` | `id`, `fromWorkId`, `toWorkId`, `reason`, actor, time, manifest reference | Audit reversible identity operations |
| `work_redirects` | `fromWorkId`, `toWorkId` | Preserve old links, prevent loops, resolve to canonical target |

Implementation detail for `external_mappings`: do not use an unconstrained polymorphic `entity_id` and assume a foreign key exists. Prefer nullable typed `work_id`, `edition_id`, `author_id`, and `series_id` columns, each with a real FK, plus a check requiring exactly one and consistency with `entity_kind`. Separate typed mapping tables behind one service are also acceptable.

Descriptions and URLs from providers are untrusted. Sanitize descriptions before rendering and restrict server-side outbound fetch targets. Store provider snapshots only under an explicit retention and permitted-use policy; preserve personal legacy metadata independently of provider cache retention.

### Personal tables

| Table | Principal columns | Rules |
|---|---|---|
| `user_books` | `id`, `userId`, `workId`, `selectedEditionId?`, `status`, `isFavorite`, `addedAt`, `archivedAt?`, `personalTitle?`, `personalAuthor?`, `personalCoverUrl?`, `legacyMetadata`, `version` | Unique active logical relationship per user/work; use one row with archive state by default |
| `user_book_editions` | `id`, `userBookId`, `editionId?`, `format`, `ownership?`, `label?`, preserved source reference | Optional copy/format associations; needed to retain multiple legacy copies without duplicate main tiles |
| `reading_sessions` | `id`, `userBookId`, `editionId?`, `state`, `startedAt?`, `finishedAt?`, `startDate?`, `finishDate?`, `datePrecision`, `format`, total snapshots, `source`, `version` | One reading attempt, including rereads; not a timer session |
| `progress_entries` | `id`, `readingSessionId`, `unit`, `position`, `occurredAt?`, `localDate`, `timeZone?`, `kind`, `supersedesId?`, `clientMutationId`, `createdAt` | Append events for observed position, baseline, or correction; no invented daily history |
| `ratings` | `id`, `userBookId`, `ratingUnits`, `contributesToCommunity`, timestamps | One current personal work rating, half-star precision; community contribution opt-in |
| `reading_session_ratings` | `readingSessionId`, `ratingUnits`, `ratedAt?`, `source` | Optional rating snapshot for a particular reread; not another community vote |
| `shelves` | `id`, `userId`, `name`, `description?`, `position`, `createdAt`, `updatedAt` | Private custom shelves; system shelves are queries |
| `shelf_items` | `shelfId`, `userBookId`, `position`, `addedAt` | Unique membership pair; same owner enforced |
| `margins` (v2 namespace) | `id`, `userBookId`, `readingSessionId?`, `editionId?`, `type`, `text`, location fields, `isFavorite`, timestamps, source | Preserve exact note/quote text and original creation time |
| `tags`, `user_book_tags`, `margin_tags` | owner-scoped label and membership keys | Tags are personal; preserve raw legacy labels and map explicitly |
| `goals` (v2 namespace) | `id`, `userId`, `metric`, `target`, `periodKind`, `periodStart?`, `periodEnd?`, `timeZone`, `countPolicy`, source | Preserve legacy goals; new calculation semantics explicit |
| `settings` (v2 namespace) | `userId`, appearance fields, preference JSON, `timeZone`, `locale?`, privacy options, `schemaVersion` | Versioned extension object; unknown preference keys preserved |
| `reading_queue` | `userId`, `userBookId`, `position`, `pinnedAt?` | Explicit Next selection and optional short queue |

Supporting operational tables should include `migration_runs`, `migration_source_records`, `legacy_entity_mappings`, `migration_conflicts`, and a transactional mutation journal/outbox for reliable derived work and rollback support. Keep them out of user-facing product language.

### Cross-table integrity

- Reuse `users.id` as the owner FK; avoid account recreation.
- A selected edition must belong to the relationship's work.
- A session edition must belong to that work, even if it differs from the current preferred edition.
- A margin's session must belong to its user book; a location-specific edition must be compatible.
- Shelf membership cannot point across owners. Use composite keys/FKs where feasible, in addition to service checks.
- Progress belongs to a valid reading attempt, with finite nonnegative values and a supported unit.
- Page counts/durations cannot be negative. Unknown is null, not zero.
- Use `timestamptz` for newly recorded instants. Use date-only fields for genuinely date-only user input, with an explicit precision discriminator so incompatible representations cannot coexist.
- Do not silently reinterpret old timezone-less timestamps. Document source connection/timezone assumptions and preserve raw values.
- Use database checks and unique indexes for invariants, not only Zod validation.
- Do not cascade shared catalog deletion into personal history. Prefer redirects/retirement for catalog records and restrictive FKs.
- Archive/remove-from-library should preserve history by default. Full data deletion is a separate explicit account-owned action with well-defined cascade behavior.

### Illustrative constraints

```sql
-- Names simplified; integrate with the chosen Drizzle namespace strategy.
UNIQUE (user_id, work_id)                          -- user_books
UNIQUE (shelf_id, user_book_id)                    -- shelf_items
CHECK (rating_units BETWEEN 1 AND 10)             -- 0.5..5.0 stars
UNIQUE (user_book_id)                             -- current ratings
CHECK (position >= 0)                             -- progress entries
UNIQUE (reading_session_id, client_mutation_id)   -- deduplicate retries

-- Proposed initial policy: one open attempt per user book.
CREATE UNIQUE INDEX one_open_attempt_per_user_book
ON v2.reading_sessions (user_book_id)
WHERE state IN ('active', 'paused');
```

An absent rating is no row/null in the DTO; zero is not a negative review. If legacy zero meant unrated, map it accordingly while retaining raw metadata. Out-of-range or conflicting legacy values must enter a conflict report, not get rounded or silently discarded.

**Migration exception requiring a decision before schema finalization:** multiple legacy rows for the same user/work may contain simultaneous active reads with incompatible positions, personal titles/covers, or statuses. The proposed unique relationship and single-open-attempt policy must not force their deletion or closure. Inventory these cases first. If present, either support distinct copy/attempt contexts under one relationship (and relax the open-attempt index accordingly), or retain provisional separate identities until a reviewed consolidation is possible. The UI must expose the preserved active contexts. A raw archive alone is insufficient preservation of something the user is actively using. Account cutover is blocked until this conflict is represented or explicitly resolved.

## 6. Reading lifecycle and metric semantics

### User-facing statuses

`want_to_read`, `reading`, `paused`, `read`, `dnf`. Map `wishlist → want_to_read` and `finished → read`; other legacy statuses map directly. Preserve the raw original value for unsupported records.

Reading status is not a shelf. A previously finished work can be currently reading during a reread. Thus “Read history” means “has completed attempts,” while a “Read” status filter means “current status is read.” Label those filters distinctly.

### Reading attempt state machine

```text
Start -> active -> paused -> active
            |                  |
            +----> completed <--+
            +----> dnf
Completed / DNF -> Start again -> new attempt
```

- Starting a reread creates a new attempt without resetting older attempts.
- Finishing atomically closes the attempt, records completion, updates the relationship, and enqueues any aggregate recalculation.
- A retry of finish must not create another completion.
- “Already read” supports an unknown date; do not pretend it was completed today.
- Correcting a mistaken finish reopens or corrects the same attempt with an audit trail; a genuine reread creates a new one.
- Removing an accidental progress event is a correction with defined recalculation, not an unexplained disappearance.
- A finish can exist without a logged start. Imported completion-only history is first-class valid data.
- Unknown total length must not prevent starting or finishing.

### Progress units and edition changes

Use canonical units: integer pages, integer seconds for audio, or percentage with defined precision. UI may present hours/minutes and convert explicitly. Never equate audio seconds with pages.

A recorded position is not necessarily newly consumed content. The first imported/current position establishes a baseline. Later compatible positive deltas can count toward logged activity. Backward corrections, edition changes, and baseline imports must not create fake reading volume.

Store totals/format on the attempt as snapshots. Updating a catalog edition's page count must not rewrite old yearly totals. On edition change, require an explicit progress policy: retain a compatible location, reset baseline, or use a user-confirmed converted percentage. Preserve the old location and source; do not automatically equate page 120 across editions.

For a mixed-format read, the initial implementation may support switching format with a new baseline and segment provenance. If simultaneous format progress is deferred, preserve all legacy positions in source records and explain the limitation rather than discarding them.

### Example event behavior

```text
Sep 1: observed page 40, baseline         -> no claimed daily pages
Sep 2: observed page 65                  -> 25 logged pages
Sep 2: correct mistaken page 65 to 60    -> 20 logged pages after recalculation
Sep 3: observed page 80                  -> 20 logged pages
Sep 4: change edition, confirm page 95   -> baseline reset; no claimed 15 pages
```

Handle events in occurred-time order with deterministic tie-breaking. A correction supersedes its target; do not naïvely sum all positive deltas including superseded values. Recompute the affected attempt/window for backdated edits. Guard mutations with expected version and an idempotency key so simultaneous updates cannot silently overwrite one another.

### Analytics definitions

- **Completed reads:** completed attempts; includes rereads.
- **Unique works read:** distinct work IDs with at least one completed attempt.
- **Logged pages/audio time:** observed activity under the event rules above.
- **Pages in completed books:** snapshot lengths of completed attempts; a separate, explicitly named metric.
- **Active days:** dates containing genuine logged activity; margin-only days can be shown in the diary but need not count as reading days.
- **Reading pace:** valid logged activity divided by eligible logged days; show coverage/unknown states.
- **Time to finish:** only when a reliable start and finish are present; never use date added as an inferred start.
- **Genres:** distribution among books with sufficiently known classification; show unknown coverage and avoid double-counting multi-genre works without a documented rule.
- **Highest-rated author:** state minimum sample size and rating policy; do not imply significance from one rating.

Store the user's timezone for day/goal boundaries. Preserve event-local dates; changing timezone should not unexpectedly rewrite a person's diary. Week-start preference and leap-year/DST boundaries need tests.

## 7. Catalog identity, search, and provider abstraction

### Work-first, edition-second UX

Ordinary title/author search should return one card per known canonical work. A result shows title, author, cover, optional series, library status, and an obvious Add/Want to Read action. Edition choice is optional and secondary.

ISBN search resolves the specific edition, then displays its parent work with that edition preselected. Saving an ISBN must not create a second top-level book when the work is already in the user's library. Offer “Already in your library,” “Use this edition,” or “Add another format/copy” as appropriate.

Translations, regional titles, reprints, and format variants may share a work when the evidence supports it. Adaptations, abridgments with materially different content, annotated studies, retellings, omnibuses, boxed sets, and separate volumes need explicit identity rules. Do not satisfy the one-book principle by incorrectly merging different works.

### Provider roles

**Open Library is the primary bibliographic backbone, not the application database.** Its search API returns works by default and can include edition data. Use this structure instead of flattening an edition into a personal book row. [Open Library Search API](https://openlibrary.org/dev/docs/api/search)

Use Google Books as an optional enrichment/fallback adapter for useful title, description, cover, language, and identifier evidence. Google Books exposes volume IDs and supports fielded searches including ISBN; a volume ID must not be treated as a Basgiath work ID. Keep the API key server-side and separate public catalog lookup from Google account authorization. [Google Books API usage](https://developers.google.com/books/docs/v1/using)

Providers must be replaceable without migrating personal relationships. Google Books failure must not prevent existing-library reading or force identity changes.

### Adapter contract

```ts
type ProviderRef = {
  provider: string;
  kind: "work" | "edition" | "volume" | "author";
  id: string;
};

type CatalogCandidate = {
  ref: ProviderRef;
  workRef?: ProviderRef;
  title: string;
  alternateTitles: string[];
  contributors: { name: string; ref?: ProviderRef; role: string }[];
  identifiers: { scheme: string; value: string }[];
  language?: string;
  format?: string;
  pageCount?: number;
  coverUrl?: string;
  evidence: { field: string; source: ProviderRef; fetchedAt: string }[];
};

interface CatalogProvider {
  search(input: { query: string; locale?: string; cursor?: string },
         signal: AbortSignal): Promise<{ items: CatalogCandidate[]; cursor?: string }>;
  get(ref: ProviderRef, signal: AbortSignal): Promise<CatalogCandidate | null>;
  listEditions?(work: ProviderRef, cursor?: string): Promise<{
    items: CatalogCandidate[]; cursor?: string;
  }>;
}
```

Normalize and validate every response. Provider payloads are not domain DTOs. Explicitly handle missing fields, unknown contributor identity, malformed IDs, timeouts, 429s, and partial responses.

### Search flow

1. Normalize whitespace and query structure without destroying meaningful Unicode or title distinctions.
2. Detect/check ISBN and known provider IDs.
3. Search the local catalog first; show already-added status through a private overlay.
4. Request bounded Open Library results; enrich/fallback only when useful.
5. Resolve known mappings and redirects.
6. Group candidates by supported canonical identity; rank by query relevance, author agreement, language preference, and data quality.
7. Present a stable result list and a partial-results indicator if a provider fails.
8. On selection/save, resolve or create the durable canonical record in a transaction; recheck existing user membership.
9. Queue optional enrichment after the user action succeeds.

Debounce typing, cancel stale requests, and ignore older responses that finish after newer ones. Do not reorder the card under the user's pointer during background enrichment. Local/private overlay caches must be separated by user; public catalog caches must never contain margins, shelf names, or private rating values.

### Conservative canonicalization

Use a hierarchy of evidence, not a single fuzzy string score:

1. Existing verified provider mapping resolves directly.
2. Exact edition ID or normalized ISBN can establish edition evidence, checked against author/title/content conflicts and existing associations.
3. A trusted work relationship can establish work identity, subject to known provider split/merge anomalies.
4. Title aliases plus matching author identities plus compatible content/language/series evidence can suggest a merge.
5. Weak matches remain separate provisional records with a review candidate.

Title-only and author-name-only matches never auto-merge. Normalize ISBN-10/13 with checksum validation, preserve raw forms, and flag conflicting ISBN evidence. An ISBN is not a universal work identifier. Never match personal books solely on covers, page count, or similar titles.

Keep a labeled fixture corpus containing duplicates and adversarial non-duplicates: regional Harry Potter titles, identical titles by different authors, book versus film adaptation, abridged audio, omnibus versus individual books, translators, author pseudonyms, missing ISBNs, malformed provider IDs, and manual books. Auto-merge must produce zero false positives in that corpus before rollout; ambiguous examples should remain reviewable.

### Lazy catalog seeding

Persist works when a user saves them, when migration requires them, or when a deliberately bounded detail-view cache promotion is useful. Cache searches with a TTL instead of permanently inserting every hit. Fetch editions when an edition is needed. Do not enumerate all editions for every search result or recursively ingest every related author and series.

Use timeouts, bounded retries with jitter, response caching, negative-result caching, and deduplicated jobs. Enrichment failures leave a usable provisional book. Migrations must run offline against their captured inputs; a provider outage must not alter migration correctness.

Open Library asks clients to cache, identify their application, and avoid bulk harvesting/high-traffic backend use. Its published limits at this review are 1 request/second unidentified and 3 identified; configure conservative shared limits and recheck before deployment. These are provider limits, not per-user allowances. [Open Library API guidance](https://openlibrary.org/developers/api)

### Field precedence and personal overrides

Use curated/locked canonical values before high-confidence provider evidence; resolve conflicting provider values by documented field-specific rules. Preserve sources and fetch dates. Null/empty enrichment must not erase useful values.

Personal title, author display, cover, and reading totals from legacy records must remain available as personal overrides/snapshots. Provider refresh must not undo a user's choice. Manual/private records should not become public catalog text without a deliberate publication path; retain private overrides and a provisional identity as needed.

### Duplicate collapse and reversible merges

Search grouping is not destructive merging. Durable merges require a manifest:

- Source/target IDs, identity evidence, field conflicts, timestamps, operator/policy version.
- All affected user relationships and source IDs.
- Session, margin, edition association, shelf, rating, favorite, and metadata mappings.
- Before/after counts and hashes for private content.
- Redirects and aggregate rebuild instructions.

If two legacy rows belong to the same user and resolve to one work, collapse the main tile only after preserving both source records. Union shelves/tags and retain favorite intent. Preserve separate attempts and edition associations. Do not deduplicate identical completion timestamps solely by date; they may be separate records. Keep conflicting ratings/statuses/overrides in the conflict ledger and require a deterministic reviewed resolution before cutover. A current display choice must never erase the other source value.

Unmerge must restore provenance-based assignments. Content created after a merge without a clear original target requires explicit resolution; do not claim all post-merge edits can be mechanically split. Block risky merges while unresolved conflicts exist.

## 8. Data migration and reconciliation

### Stage A — inventory and immutable source capture

On a restored clone, inventory row counts by user, metadata key/type distributions, statuses, formats, completion arrays, orphan relationships, missing settings, dates, invalid values, and duplicate candidates. Keep reports private or sanitized; never commit the girlfriend's notes as fixtures.

Create a source-record ledger with migration run ID, legacy table, legacy primary key, owner ID, exact raw row representation, semantic hash, and mapping state. Preserve every field even if v2 does not expose it immediately. Use synthetic fixtures derived from shapes, not copied personal content.

### Stage B — additive target schema

Create v2 structures without altering or dropping legacy tables. Review generated SQL, index strategy, constraints, lock behavior, and migration ordering. Applied migration files remain immutable. Never use `db:push` as the production v2 migration plan.

Use a source role with read-only access where feasible and a target role scoped to v2 writes. A development restore must not accidentally retain production email/webhook side effects or live sessions.

### Stage C — deterministic backfill

- Seed provisional works and editions from legacy rows without requiring remote calls.
- Resolve strong known mappings; leave weak matches separate.
- Create user relationships and preserve personal bibliographic overrides.
- Convert each `reads[i]` into a distinct completed attempt keyed by source book ID and array index.
- Preserve completion timestamps; set unknown starts to null.
- Create an open attempt for current reading where appropriate. Its imported current position is a baseline, not historical activity.
- Preserve DNF/wishlist/finished status even when completion history is missing or contradictory. Report contradictions and use an explicit compatibility policy.
- Normalize recognized ratings/tags but keep the full original metadata JSON.
- Copy margins with exact text, type, location, timestamps, and legacy link mappings.
- Copy goals and database settings; separately merge captured UI preferences.
- Record every source row's disposition and every inferred/defaulted field.

```ts
for await (const sourceUser of snapshot.users()) {
  await target.transaction(async tx => {
    const run = await acquireUserMigrationLock(tx, sourceUser.id);
    for (const legacyBook of sourceUser.books) {
      const source = await recordSourceOnce(tx, run, legacyBook);
      const identity = await resolveFromCapturedEvidence(tx, source);
      const userBook = await mapUserRelationship(tx, source, identity);
      await mapLegacyReadsByArrayIndex(tx, source, userBook);
      await preserveMetadataAndPositions(tx, source, userBook);
    }
    await mapMarginsGoalsSettings(tx, sourceUser);
    await assertUserReconciliation(tx, sourceUser);
    await markUserBackfillComplete(tx, run);
  });
}
```

This is conceptual. For large users, use resumable bounded batches plus a completion barrier instead of a long transaction; partial targets remain hidden until the entire account validates. Mapping uniqueness must make re-runs idempotent. Retry after interruption must produce the same target identities and counts.

The example describes one immutable snapshot. Final-delta processing must version source records rather than letting `recordSourceOnce` skip changed rows. Legacy completion arrays can be edited, reordered, or shortened; array-index identity is only stable within its source revision. Compare the final array and reconcile projections explicitly, preserving older source revisions in the audit ledger while superseding obsolete target projections before v2 writes begin. Handle deleted books and their cascaded margins as well. Final target multiplicity must match the final source plus documented merge decisions, not the union of every historical backfill run.

### Stage D — field-level reconciliation

Counts alone are insufficient, especially after duplicate collapse.

| Source property | Required proof |
|---|---|
| Every legacy book | Exactly one recorded disposition and mapping; source payload retained |
| Title/author/cover | Canonical value or preserved personal/source value, with conflicts reported |
| Metadata | Semantic equality of raw JSON; normalized projections do not replace it |
| Every completion array item | One mapped attempt or explicit reviewed disposition; index-based provenance |
| Current page/minute and totals | Preserved numeric value and original unit; conversion recorded |
| Every margin | Exact text/type/location/date plus correct same-owner target |
| Goals | Metric/target/timeframe/createdAt preserved; new metric policy labeled |
| Settings | All database and captured local preferences accounted for |
| Duplicate groups | Many-to-one mapping manifest, zero discarded personal objects |
| Owners | No cross-user links; account identity unchanged |

Use sorted canonical JSON for semantic hashes, preserving array ordering where meaningful. Also retain raw source files with byte checksums. Compare precision carefully: JSON timestamp formatting may change while the instant remains equal, but an unknown timezone cannot be assumed equivalent.

Migration output should include run ID, tool version, source snapshot ID, start/end time, per-user counts, conflicts by severity, rejected rows, mapping coverage, hash comparison results, and exit status. Zero unexplained loss is required. A quarantined row is not successful migration unless it remains accessible and its disposition is accepted before cutover.

### Stage E — shadow reads

Legacy stays the serving/write authority. Run v2 read models in shadow and compare normalized results for the same consistent source version. Do not label comparisons against different write moments as migration failures or successes. Normalize intentional changes such as work grouping separately from data loss.

Exercise the girlfriend's restored account through core screens, including margins and completion history. Record disagreements without logging private content.

### Stage F — final delta and cutover

Recommended initial strategy for this small deployment: a short, planned write pause rather than fragile long-lived application dual-writes.

1. Ship tested server-side write gating and the compatible v2 application build in advance.
2. Rehearse migration, final delta, and rollback on staging.
3. At cutover, stop all relevant writes, including background jobs, imports, and stale-client endpoints; drain in-flight transactions.
4. Capture a final backup/snapshot and source digest under the write barrier.
5. Apply a complete reconciliation against that final snapshot, including updates and deletions since the original backfill. Without legacy change tracking, scan/hash all relevant source rows rather than relying on a nonexistent `updatedAt` column.
6. Run the full reconciliation gates.
7. Atomically switch the account/data authority to v2, then permit v2 writes.
8. Keep v1 mutation endpoints blocked for migrated accounts, even from old tabs.
9. Retain legacy tables and source archives throughout the stabilization period.

If a short pause is unacceptable, implement change capture/outbox and ordered replay before using online cutover. Do not improvise dual-write promises in the browser or two independent server writes; partial success produces divergence.

## 9. Rollback and ongoing write safety

**A feature flag cannot reverse a data migration. Old tables become stale once v2 accepts new writes.**

Separate three situations:

| Situation | Safe response |
|---|---|
| Before v2 writes begin | Keep/switch legacy authority; v2 can be discarded and rebuilt after capturing diagnostics |
| UI regression after v2 writes | Roll back the presentation build only if it still uses the compatible v2 service/data model |
| V2 data/service regression after writes | Enter maintenance/read-only, preserve new writes, repair forward or use a rehearsed replay/projection procedure |

Before v2 write cutover, implement a transactional mutation journal or equivalent recoverable database strategy covering acknowledged v2 changes, including corrections, deletes, imports, and relationship changes. The journal is not a replacement for full backups. Test replay idempotency and ordering and include preimages where reversal needs them.

A return to old v1 binaries requires a tested projection of all representable post-cutover changes back into v1 plus durable preservation and later replay of v2-only data. Shelves/progress/session detail do not fit the old schema. If that projection is not built, explicitly document **no writable v1 rollback after cutover**; the supported fallback is read-only recovery or a v2-compatible prior build. Never advertise otherwise.

Proposed targets for rehearsal: zero lost acknowledged writes during planned cutover; recovery to a usable read-only or compatible build within a target agreed after measuring the restore drill. Do not promise a recovery time or infrastructure point-in-time recovery capability before verifying it.

Rollback runbook:

- [ ] Identify incident, authority state, last acknowledged mutation, and deployed revision.
- [ ] Stop affected writes server-side and drain requests.
- [ ] Snapshot the current state and retain the journal before repair/restore.
- [ ] Select compatible app rollback, forward repair, or isolated backup restore plus replay.
- [ ] Reconcile personal records and post-cutover writes.
- [ ] Resume reads, then writes, with monitored smoke tests.
- [ ] Record incident cause and affected scope without exposing personal content.

Old tables may only be retired in a later dedicated change after stable operation, validated v2 backups/restores, resolved conflicts, an agreed retention period, and explicit destructive-change authorization. No retirement is part of the initial rebuild.

## 10. Web information architecture and interaction design

### Navigation

Use **Home · Library · Add · Margins · You** as the organizing model. Add may be a prominent action instead of a destination route. Desktop and mobile should express the same concepts. You groups history, insights, goals, settings, and account controls. Community has no tab.

Retain deep links to existing book pages through owner-aware legacy mappings or safe redirects. Back navigation must preserve filters, selected year, view mode, and scroll position.

### Home — the next reading action

Accepted as currently implemented, per the September 12 scope decision. No further redesign, modules, or quick-action expansion is planned. Preserve the current appearance and behavior; address actual defects without turning them into a redesign.

### Library — the centerpiece

Library is a warm overview, not every control at once:

- Currently Reading.
- Up Next.
- Your Shelves.
- Series in progress.
- Recently Added.
- Recently Read.
- A clear All Books entry and Add action.

Do not load every shelf's entire contents for the overview. Use bounded previews and counts. Empty states explain how to add the first book/shelf without blocking exploration.

### All Books — the precise browser

Always expose count, search, sort, filters, and view choice. Search the user's collection here; global catalog search belongs to Add and should be clearly labeled if offered as a fallback.

Filters: status, has-been-read/history, format, shelf, favorite, personal rating range/unrated, author, series, tags, and completion year. Ownership filters are only offered if ownership is actually captured. Support clear-all and visible active filters.

Sorts: recently added, recently read, title, author, personal rating, community rating when enabled, and known page count. Use deterministic secondary IDs, explicit null placement, and defined direction. Search/filter/sort must happen over the whole library, not just the loaded page.

Persist filters/sort in URL state and view preference per user/device as appropriate. Use stable pagination/cursors and avoid duplicate/missing results as items update.

### List, grid, and bookshelf

All three consume the same query result model, count, ordering, and actions:

- **List:** title/author, cover, status, rating, progress or finished date; dense but readable.
- **Grid:** cover-led browsing with sufficient labels and keyboard focus.
- **Bookshelf:** attractive spines with intentional row layout, stable sizing, readable titles, and accessible equivalents.

No hover-only essential information. Touch/keyboard users can open every book. Missing covers render deliberate placeholders. Respect reduced motion and contrast. Avoid random spine colors/heights changing on every render. Long titles and large font settings must remain usable.

Acceptance: switching view on “Read in 2025, Favorites” preserves exactly the same result set and order. Shelf view cannot revert to `allBooks`.

### Shelves

System collections are derived: Currently Reading, Want to Read, Read/history as labeled, DNF, Paused, Favorites. Custom shelves support create, rename, description, reorder, add/remove items, and delete shelf without deleting books.

A book can belong to many shelves. Removing shelf membership does not change reading status or erase history. Reordering has keyboard/button alternatives to dragging. Favorites is a separate boolean and does not follow automatically from a five-star rating. Shelves are private by default.

Avoid smart-shelf rule builders in the first release; preserve room for them in the model without shipping a generic query language UI.

### Book detail

Lead with the work's cover/title/author, series context, personal status, and next action. Sections:

1. Your Reading: progress, start/pause/finish/reread, history.
2. Your Rating: half-star input, Favorite, optional private thought.
3. Margins: add and browse notes/quotes.
4. About: description and contributor context.
5. Community rating: aggregate and distribution, when enabled.
6. Edition: preferred edition, format, language, length, publisher/ISBN in secondary detail.

Rename the legacy “Book Reviews” label if it only contains stars/tags. Avoid making edition metadata dominate the page. Allow manual book addition and personal metadata correction.

Finishing should feel lightweight: completion date, optional rating/favorite/thought; do not force all fields. Preserve an unknown finish date when that is what the user knows.

### Reading calendar and history

The calendar is a diary generated by real events, not a streak-pressure mechanic. Day detail shows progress, completions, and margins, distinguishing their event types. Imported completion-only records appear as completions, not inferred daily reading sessions.

History can group by year and work, with each reread expandable. Provide All Time and unknown-date groups. Switching between unique works and completed reads must label the number. Clicking a day or year applies clear filters that survive navigation.

### Series tracking

Show known ordered works, read markers, personal ratings, and a Continue Series action. Count completed unique works, not rereads. Distinguish “2 of 3 known main books read” from a verified complete series of three. Optional novellas and alternate reading order must not silently change completion percentage.

Unknown series data is acceptable. Series membership must come from recorded evidence or curation, not unverified guessing from titles. The user can pin a next book even when series metadata is incomplete.

### Margins — a signature feature

Support note/quote types, exact text preservation, location by page/chapter/audio timestamp/freeform label, optional session link, favorites, tags, search, and filters by book/type/date. Show a chronological reading-memory view and per-book view.

- Add from Home, Book detail, and Margins without losing the reading context.
- Retain drafts on transient network failure; never label an unsaved note as saved.
- Editing preserves created time and adds updated time.
- Text is private by default and excluded from community aggregates/provider requests.
- Search respects owner isolation and handles punctuation/Unicode.
- Markdown export includes book, type, location, date, and full text with correct escaping.
- JSON archive preserves all fields and links.
- Future quote OCR remains deferred.

### Personal insights and goals

Present yearly/all-time reading history, rereads, favorite books/authors, ratings distribution, known genres, longest known book, logged activity, and pace only where supported. Use plain labels and explain incomplete data inline.

Keep goals optional and encouraging. Preserve existing goals, but distinguish legacy completion-based page/minute totals from newly logged activity. Choose a documented migration default and expose any changed interpretation; do not silently make a user's historical goal progress collapse.

A future shareable Year in Books is a generated artifact the user explicitly chooses to share, not a public profile. Private margin text must not enter it by default.

### Accessibility and responsive quality

- Keyboard traversal, visible focus, semantic headings, labeled controls, sensible dialog focus/escape.
- Screen-reader rating labels such as “4.5 out of 5”; half-stars are selectable without precision pointer work.
- Touch targets remain usable on small phones; desktop offers efficient controls.
- Respect font scaling, reduced motion, light/dark themes, and custom accents.
- Test long titles, missing covers, empty libraries, large libraries, audio-only libraries, and network errors.
- Preserve unsaved edits across recoverable failures and warn before losing an active draft.

## 11. Personal and community ratings

Store half-star ratings as integer units 1–10. The display value is `ratingUnits / 2`. Personal favorites are independent. A current work rating is separate from optional historical attempt ratings.

Community aggregates include at most one eligible current rating per user per canonical work. Rereading cannot increase vote count. A work merge must reconcile duplicate same-user votes before recomputing aggregates.

Proposed privacy default: existing ratings remain private and do not contribute until the user opts in to anonymous aggregation. Do not reinterpret old private metadata as public consent. Provide a clear setting and allow withdrawal. With the initial small user base, suppress aggregate display below a configurable minimum sample size (proposed five), showing “Not enough ratings yet.” Do not fabricate starter counts or blend provider ratings into Basgiath's own metric.

If external ratings are ever displayed, show them separately with their provider and permitted usage; this is deferred from initial community implementation.

```sql
-- Conceptual after canonical resolution and eligibility filtering:
SELECT work_id,
       count(*) AS rating_count,
       sum(rating_units) / (2.0 * count(*)) AS average_stars
FROM eligible_current_work_ratings
GROUP BY work_id;
```

Maintain ten half-star histogram buckets. Start with indexed queries or a simple aggregate table refreshed through an outbox. Updates, deletions, opt-out, account deletion, and work merges must all invalidate/rebuild results. Avoid per-request full scans as data grows. Show rounded averages, sample counts, and a useful distribution without implying statistical certainty.

No rating feed, reviewer identity list, likes, or comments. Written public reviews require a later separate product decision and moderation design.

## 12. API contracts and authentication boundaries

Prepare for future native clients by making services transport-independent now. Do not build a native client or a broad speculative auth framework.

TanStack server functions call these services first. Add a versioned HTTP adapter for the implemented core operations when contracts stabilize; both adapters must share authorization and transactions.

Suggested endpoints (proposed, not existing):

| Method / path | Purpose |
|---|---|
| `GET /api/v1/catalog/search` | Work-grouped global search |
| `GET /api/v1/works/:id` | Public catalog detail plus separately authorized personal overlay |
| `GET /api/v1/works/:id/editions` | Bounded edition selection |
| `GET /api/v1/library` | Private filtered/paginated collection |
| `POST /api/v1/library` | Resolve/save work atomically |
| `PATCH /api/v1/user-books/:id` | Narrow personal properties with version check |
| `POST /api/v1/user-books/:id/reading-sessions` | Start an attempt |
| `POST /api/v1/reading-sessions/:id/progress` | Record progress idempotently |
| `POST /api/v1/reading-sessions/:id/finish` | Finish attempt atomically |
| `PUT /api/v1/user-books/:id/rating` | Set current work rating |
| `GET/POST /api/v1/shelves` | Private shelf management |
| `PUT/DELETE /api/v1/shelves/:id/items/:userBookId` | Membership |
| `GET/POST /api/v1/margins` | Private notes/quotes |
| `GET /api/v1/insights` | Defined private metrics |
| `POST /api/v1/imports/preview` | Validate and preview archive |
| `POST /api/v1/imports/:id/commit` | Apply a validated, bound preview |
| `GET /api/v1/exports/:id` | Authorized generated archive download |

DTOs use stable IDs, explicit units, ISO instants/date-only fields, nullability, cursors, and version fields. Errors have stable codes such as `VALIDATION_FAILED`, `NOT_FOUND`, `VERSION_CONFLICT`, `PROVIDER_UNAVAILABLE`, and `WRITE_PAUSED`, with a request ID. Do not return SQL errors or stack traces to clients.

Bind import previews to the actor, payload hash, expiry, and expected data version. A changed library between preview and commit requires revalidation. Idempotency keys must be actor/operation scoped with request-payload fingerprints; reusing a key with different content is an error.

### Auth now versus later

Verified current auth uses username/password, bcrypt, server sessions, and localStorage-held session information. Preserve existing account IDs/password compatibility during data migration. Guest behavior must remain explicit and tested; guests must not gain production-user mutation access.

Fix authorization immediately. Separately evaluate secure HttpOnly cookie sessions, CSRF/origin defenses, session expiry/revocation, login rate limiting, and removal of sensitive session logging. Do not describe the existing localStorage token approach as a desired native-client contract.

Future native authentication may require standards-based token flows, refresh rotation, device revocation, and secure device storage. Record that boundary in an ADR and defer implementation until the native project is authorized. Never expose a database connection or TanStack internal wire protocol as the native API.

## 13. Testing and quality gates

### Existing baseline

Existing tests include `open-library.test.ts`, `store-load-state.test.ts`, `auth-signup.test.js`, `session-auth.test.js`, and `user-preferences.test.js` under `src/lib`. `package.json` has build/lint scripts but no unified test or typecheck script.

Proposed initial verification commands, after provisioning a compatible Node toolchain and dependencies:

```sh
npm ci
npm run lint
npx tsc --noEmit
node --experimental-strip-types --test src/lib/*.test.js src/lib/*.test.ts
npm run build
```

These commands were not run as successful checks during this documentation task; Node was not available on the auditing agent's PATH. Verify compatibility of the existing TypeScript tests with the pinned Node version and imports before standardizing the test command. Add explicit `test`, `test:integration`, `test:e2e`, and `typecheck` scripts as implementation warrants. Do not report unexecuted tests as passing.

### Required test layers

**Unit/domain:** status transitions, half-stars, unit conversions, date precision, progress correction, goal boundaries, conservative identity rules, archive validation, and deterministic migration transforms.

**PostgreSQL integration:** real constraints, ownership, transactions, duplicate save races, idempotent progress/finish, import rollback, migration resume, same-user merge conflicts, and settings upsert. Disposable databases only.

**Contract:** provider response fixtures, malformed/partial responses, stable DTOs, server-function/HTTP equivalence, cursor behavior, error codes, and no private-field leakage.

**End-to-end:** sign in; find/save/manual add; reread; page/audio progress; finish/rate/favorite; shelf membership; all three views; margins; export/import in an isolated account; settings; old deep link; stale client after cutover.

**Migration/operations:** restore drill, interrupted migration rerun, final source delta including deletions, shadow comparison, write barrier, compatible rollback, mutation replay, and recovery with provider outage.

### Mandatory regression cases

- [ ] Unknown metadata round-trips unchanged.
- [ ] User A cannot mutate B's book/margin/goal or attach a margin to B's book.
- [ ] Failure midway through replacement import leaves original data intact.
- [ ] Two concurrent saves create one user relationship for the same work.
- [ ] Repeated finish request creates one completion.
- [ ] Reread keeps earlier dates and margins.
- [ ] Completion-only import has unknown start and no invented calendar activity.
- [ ] First progress baseline does not count an entire historical book as today's reading.
- [ ] Audio hours/minutes convert correctly; legacy raw values are retained.
- [ ] Edition change does not rewrite prior totals or reinterpret prior page locations.
- [ ] Same title/different author does not auto-merge.
- [ ] Work merge preserves every private object and one eligible vote per user.
- [ ] List/grid/bookshelf return identical filtered IDs.
- [ ] Theme/font preference migration retains supported choices and raw unmapped settings.
- [ ] Deleting a shelf does not delete a book or margin.
- [ ] Provider outage leaves personal reading operations usable.
- [ ] Opt-out removes community contribution.
- [ ] Date boundaries work around midnight, DST, leap days, and unknown dates.
- [ ] No live data or credentials appear in fixtures, screenshots, traces, or logs.

### Performance acceptance targets

Proposed initial targets, measured on documented hardware and a production-like database: private library queries p95 under 300 ms, ordinary private writes p95 under 500 ms excluding network, useful local search feedback under 300 ms, bounded remote search timeout around 3 seconds with partial results. Tune after baselining rather than treating estimates as measured performance.

Test representative 100-, 1,000-, and 10,000-book synthetic accounts. Paginate queries, prevent N+1 lookups, lazy-load covers, and virtualize only where measurement justifies it. No unbounded all-user aggregate scan on every book page. Core personal-library use must not depend on external catalog latency.

## 14. Observability and operations

Build on existing error-capture and health-check code after checking the actual request path.

The current `error-capture.ts` keeps one global recent error for five seconds. Replace reliance on that shared slot with request-correlated reporting so one request's failure cannot be attributed to another.

- Structured logs: request ID, operation name, duration, safe actor reference, error code, migration run ID when relevant.
- Never log passwords, sessions, full exports, margin text, private tags, or raw provider keys. Avoid full search-query logging by default.
- Metrics: request errors/latency, database pool pressure, provider latency/429s/timeouts, cache hit rate, enrichment queue age, migration conflicts, reconciliation mismatches, journal lag, import failures, and aggregate freshness.
- `/healthz` indicates process health; `/readyz` verifies required database/schema readiness without revealing secrets. Provider availability should degrade search, not mark the entire library unusable.
- Alerts for any reconciliation failure or attempted blocked legacy write after migration; threshold sustained errors and queue lag based on measured baselines.
- Track deployed commit, schema compatibility range, and enabled flags with each incident.
- Add an admin-only read-only migration/identity conflict report before building sophisticated admin editing.
- Keep backup retention, access control, restore evidence, and staging cleanup documented.

Use durable PostgreSQL jobs/outbox initially if background enrichment is needed. Job handlers are idempotent, bounded, retryable, and observable. Do not rely on a promise continuing after the request/process ends.

## 15. Feature flags and release mechanics

Proposed server-controlled flags:

- `catalog_v2_search`
- `library_v2_read`
- `reading_v2_write`
- `library_v2_ui`
- `shelves_v2`
- `margins_v2`
- `insights_v2`
- `community_ratings`
- `google_books_enrichment`

Keep account migration authority in durable server state, not only feature flags. Flags gate behavior; they do not establish authorization or choose an arbitrary database on every request.

Allowed combinations need tests. V2 UI cannot enable writes against an unmigrated account. Legacy endpoints cannot remain writable once that account uses v2 authority. Community can be disabled without removing personal ratings. Provider enrichment can be disabled without breaking saved books.

Roll out: local fixtures → restored staging → shadow comparison → internal synthetic account → small explicitly selected beta cohort → girlfriend's account after reconciliation and review → wider users if applicable. Do not make the person whose data matters most the first migration experiment.

Deploy schema expansion separately from application activation. Review the migration ledger and generated SQL. Set lock/statement timeouts appropriate to the operation, test lock behavior on a representative clone, and plan nontransactional index operations separately where needed. Do not automatically run migrations on every web process startup.

## 16. Suggested file and module organization

Use existing paths where useful; introduce boundaries incrementally, without mass renaming working code.

```text
shared/
  schema.ts                         # retained legacy exports initially
  schema-v2/
    catalog.ts
    library.ts
    reading.ts
    margins.ts
    settings-goals.ts
    operations.ts
  contracts/
    catalog.ts
    library.ts
    reading.ts
    archives.ts
    errors.ts
server/
  db.ts
  auth/actor.ts
  services/
    catalog-service.ts
    library-service.ts
    reading-service.ts
    shelf-service.ts
    rating-service.ts
    margin-service.ts
    insight-service.ts
    archive-service.ts
  repositories/
  catalog/
    providers/open-library.ts
    providers/google-books.ts
    normalize.ts
    resolve.ts
    merge.ts
  jobs/
    enrichment.ts
    aggregates.ts
    outbox.ts
  migration/
    inventory.ts
    capture.ts
    backfill.ts
    reconcile.ts
    final-delta.ts
    report.ts
src/
  lib/data-fns.ts                    # gradually becomes thin adapter
  features/
    catalog/
    library/
    reading/
    margins/
    insights/
  components/                       # retain shared primitives
  routes/                           # preserve TanStack conventions
migrations/                         # additive, reviewed SQL
scripts/                            # safe operator entry points
tests/                              # choose actual convention during setup
  fixtures/                         # synthetic only
  integration/
  e2e/
docs/
  decisions/
  runbooks/backup-restore.md
  runbooks/v2-cutover.md
  runbooks/v2-rollback.md
  migration-data-map.md
  metric-definitions.md
```

The tree is a suggestion, not a requirement to create empty files. Avoid hand-editing `src/routeTree.gen.ts`; use the existing route generation process. Keep imports compatible with existing alias configuration. Separate publicly shared DTOs from server database models.

## 17. Coding standards and implementation discipline

- TypeScript strictness and explicit domain types; no broad `any` or unsafe casts to bypass validation.
- Zod or equivalent boundary validation for user input, archives, and provider payloads.
- Explicit null/unknown semantics and unit-bearing field names.
- Small cohesive services; business rules do not live inside JSX or duplicate across transports.
- Transactions encompass each logical mutation and its journal/outbox entry.
- Ownership is enforced on every private access path, not only page loaders.
- Stable IDs, deterministic migrations, actor-scoped idempotency, and optimistic concurrency where writes can collide.
- Parameterized queries; no string-built SQL from user input.
- Prefer existing primitives and theme tokens; avoid hard-coded visual values that break customization.
- Optimistic UI needs rollback/error states and must not export unsaved state as durable truth.
- No swallowed errors, false success toasts, silent metadata drops, or implicit unsafe defaults.
- Keep dependencies minimal; a new package must solve a concrete need and fit the existing runtime.
- Document why subtle identity/migration rules exist with focused comments and ADRs.
- Each implementation PR describes behavior, migration impact, validation, and relevant limitations.
- Preserve unrelated working-tree changes; do not reformat the whole repository during a scoped fix.

## 18. Explicit do-not-do list

- Do not drop, truncate, rename out from under v1, or destructively rewrite the existing production tables during initial v2 work.
- Do not run schema push, replacement import, seed/reset commands, or restore experiments against production.
- Do not rely on JSON alone or claim an untested backup is safe.
- Do not lose unknown metadata, rereads, notes, original dates, settings, or duplicate-source records.
- Do not use `addedAt` as a fabricated reading start.
- Do not fabricate daily progress from a finished book or current page.
- Do not mass-convert historic audio values without verified evidence of their original units.
- Do not merge on title alone or treat every Google volume/ISBN as a work identity.
- Do not allow a catalog merge to erase personal disagreements or copy associations.
- Do not replace personal metadata choices during provider enrichment.
- Do not publish private ratings, shelves, notes, or legacy metadata by default.
- Do not blend external and Basgiath rating counts into a misleading total.
- Do not ship hundreds of fake ratings or fabricated community activity.
- Do not make catalog providers a runtime dependency for reading an already saved book.
- Do not ingest the world's catalog or fetch all editions for every result.
- Do not duplicate business logic for web and future native clients.
- Do not ship iOS or choose its full framework/auth stack as part of this work.
- Do not describe a flag flip as a safe rollback after v2 writes.
- Do not keep stale v1 mutation paths open for migrated accounts.
- Do not commit real personal data, credentials, database dumps, or private screenshots.
- Do not call the rebuild complete while any unexplained reconciliation discrepancy remains.

## 19. Phased milestones and exit criteria

### M0 — audit, safety fixes, and baseline

Deliver metadata round-trip fix, ownership repairs, regression fixtures, current data map, known-defect list, consistent archive plan, and backup/restore runbook. Fix unit/view inconsistencies in small scoped patches where feasible.

Exit: local safety tests pass; no production access assumed. Production migration remains gated on a proven restore and account manifests.

### M1 — domain foundation and services

Deliver ADRs for identity, dates/units, rating policy, duplicate handling, privacy, account authority, and rollback. Add v2 schema, constraints, service/actor boundaries, and integration harness.

Exit: schema installs on an empty isolated database; constraints reject invalid ownership/relationships; legacy behavior remains available.

### M2 — backfill and reconciliation

Deliver source capture, idempotent transform, conflict ledger, per-user reports, and interrupted-run tests. Use captured data, not live provider dependence.

Exit: synthetic adversarial corpus fully reconciles; restored production clone passes after unresolved conflicts are explicitly handled; final-delta rehearsal succeeds.

### M3 — catalog v2

Remaining scope: dependable search, manual fallback, personal metadata correction, and basic format/length controls. Extensive edition selection, global canonical consistency, and merge tooling are deferred under the September 12 scope decision.

Exit: saves are safe, provider outages have a usable fallback, and metadata/format edits preserve personal history.

### M4 — reading, ratings, favorites, shelves

Deliver attempts, progress/corrections, rereads, half-stars, independent favorites, real custom shelves, and export coverage.

Exit: end-to-end read lifecycle, concurrency, rollback of failed saves, and full v2 archive round-trip pass.

### M5 — web redesign

Preserve the accepted Home and navigation. Finish focused Library browsing and book-detail refinements within the existing UI. Preserve personalization.

Exit: filtered parity across views; accessibility pass; representative large-library performance; old deep links and preferences work.

### M6 — memory and insight features

Deliver enhanced Margins, calendar/history, series tracking, defined insights/goals, and Markdown margin export.

Exit: no invented metrics, unknown-data states visible, correct day/year boundaries, exact margin preservation, series provenance and incomplete-series labels.

### M7 — contextual community and HTTP contracts

Deliver opt-in aggregate ratings with privacy threshold and invalidation; versioned HTTP adapters for implemented services and contract documentation.

Exit: no duplicate votes from rereads/merges, withdrawal works, private data is absent from public responses, transports share service behavior. Community can stay disabled at cutover if sample size or readiness is insufficient.

### M8 — staged release and stabilization

Deliver restore evidence, shadow comparison, compatibility flags, write barrier, final delta, cutover/rollback rehearsal, operational dashboards, and an account-by-account rollout manifest.

Exit: production change is authorized, all data gates pass, all acknowledged writes are recoverable, user verifies important library/history/margins behavior, and monitoring remains healthy through an agreed stabilization window.

### M9 — later cleanup

Only after separate approval: retire obsolete code/tables with retention and backup evidence. Reconsider native clients in a new scope. No destructive cleanup is necessary to call the initial v2 product useful and stable.

## 20. Suggested sequence of commits / executable tasks

Each row should become a focused change or small PR. Do not mechanically commit untested scaffolding just to match the sequence.

| # | Suggested commit intent | Deliverable / validation |
|---|---|---|
| 1 | `docs: record baseline and v2 safety invariants` | Repo map, current data semantics, open issues |
| 2 | `fix: preserve metadata during JSON restore` | Validator + insert mapping + full round-trip fixture |
| 3 | `fix: enforce ownership on private mutations` | Owner predicates, parent checks, two-user negative tests |
| 4 | `fix: make archive replacement and settings restore reliable` | Preview/version path, settings upsert, failure atomicity |
| 5 | `fix: correct audio input units and history view filtering` | Explicit conversions and shared filtered result tests |
| 6 | `test: establish domain and database verification commands` | Reproducible test/typecheck scripts and disposable DB setup |
| 7 | `docs: add backup restore and reconciliation runbooks` | Safe target checks, private manifest format, restore drill procedure |
| 8 | `docs: decide v2 identity reading and rollback contracts` | ADRs with edge cases and chosen defaults |
| 9 | `feat: add additive v2 catalog schema` | Works/editions/authors/series/mappings, constraints |
| 10 | `feat: add v2 personal reading schema` | User books, attempts/progress, ratings, shelves, margins/settings |
| 11 | `refactor: introduce actor and domain service boundaries` | Shared authorization and stable DTOs, legacy adapters retained |
| 12 | `feat: capture legacy source records and mappings` | Immutable source ledger, semantic hashes, no production mutation |
| 13 | `feat: backfill v2 from captured legacy data` | Deterministic per-user migration with preserved raw fields |
| 14 | `test: reconcile v2 migration and resume interrupted runs` | Counts/hashes/ownership checks; duplicate/conflict reports |
| 15 | `refactor: wrap Open Library behind catalog provider interface` | Contract fixtures and bounded/cached requests |
| 16 | `feat: resolve canonical works and seed catalog lazily` | Race-safe identities, manual provisional records |
| 17 | `feat: add grouped search and optional edition selection` | ISBN flow, already-in-library behavior, partial results |
| 18 | `feat: add optional Google Books enrichment` | Flag, provenance, provider outage/collision tests |
| 19 | `feat: add reversible catalog merge workflow` | Manifest, redirects, conflict handling, unmerge limits |
| 20 | `feat: implement reading attempts and idempotent progress` | Start/pause/finish/reread, corrections, unit tests |
| 21 | `feat: add half-star ratings favorites and custom shelves` | Independent concepts, owner-safe membership |
| 22 | Closed: preserve accepted Home | No further Home redesign or expansion |
| 23 | `feat: build library overview and all-books browser` | Server filters/sorts/pagination and URL state |
| 24 | `feat: unify list grid and bookshelf presentation` | Result parity, accessible spine interactions |
| 25 | `feat: refine personal book record and history` | Modest clarity/correction improvements, basic format/length controls, preserve old attempts and links |
| 26 | `feat: expand margins and add Markdown export` | Exact text preservation, locations, tags/search/drafts |
| 27 | `feat: add reading diary series and defined insights` | Reliable metrics, incomplete-data handling, timezone tests |
| 28 | `feat: add private-by-default community rating aggregates` | Consent, threshold, update/delete/merge invalidation |
| 29 | `feat: expose versioned API adapters for core services` | Shared contract and authorization tests |
| 30 | `feat: add v2 full archive import and export` | Offline restore of all new entities with safe ID mapping |
| 31 | `feat: add account authority flags and recoverable mutation journal` | Stale-client blocks, transactional journal, replay tests |
| 32 | `ops: rehearse final delta cutover and rollback` | Restore evidence, write barrier, drift including deletes |
| 33 | `test: complete accessibility performance and release checks` | Documented measurements and unresolved blockers |
| 34 | `release: enable v2 for validated cohort` | Separate authorized deployment, per-account reconciliation |
| 35 | `docs: record stabilization and deferred cleanup` | Retention plan; no automatic legacy-table deletion |

Dependencies matter: commit numbering does not permit writing production v2 data before the journal/rollback work. UI and provider tasks can run against fixtures/staging while migration gates remain pending. The girlfriend's account should not be switched simply because the UI milestone is complete.

## 21. Master acceptance checklist

### Preservation and reliability

- [ ] Every production source row and every completion entry is accounted for.
- [ ] Every margin's full text, owner, book relationship, and timestamp survives.
- [ ] Ratings, tags, provider identifiers, and unknown metadata survive.
- [ ] Settings and captured browser preferences survive or have an explicit recoverable compatibility mapping.
- [ ] Duplicate grouping preserves all personal history and conflicting source values.
- [ ] Backup restoration and post-cutover write recovery have been rehearsed.
- [ ] Imports are validated, previewed, owner-safe, and transactional.
- [ ] New writes cannot disappear through a UI rollback or stale legacy client.

### Product behavior

- [ ] Ordinary search presents a canonical work rather than edition spam.
- [ ] ISBN lookup selects an edition without duplicating the work in the library.
- [ ] Manual books and incomplete catalog records remain usable.
- [ ] Start/update/finish/reread is coherent across Home, detail, and history.
- [ ] Favorites and half-star ratings work independently.
- [ ] Custom shelves are real many-to-many organization.
- [ ] List/grid/bookshelf preserve the exact filtered collection.
- [ ] Margins are easy to capture, find, edit, and export.
- [ ] Calendar and insights distinguish logged activity from imported completions.
- [ ] Series tracking acknowledges uncertain/incomplete catalogs.
- [ ] Community lives on books and respects contribution privacy.
- [ ] Existing themes/font preferences remain usable on mobile and desktop.

### Engineering and rollout

- [ ] Services are reusable across TanStack and versioned HTTP adapters.
- [ ] Ownership, validation, constraints, and transactions are tested.
- [ ] Providers are optional enrichment dependencies with bounded usage.
- [ ] Applied migrations are immutable; v2 migrations are additive and reviewed.
- [ ] Feature-flag combinations and account data authority are enforced server-side.
- [ ] Logs and reports avoid private reading content and credentials.
- [ ] Release metrics and health checks identify failure without hiding it.
- [ ] Native iOS remains out of scope.
- [ ] Production destructive cleanup is deferred to a separate authorized change.

## 22. Outstanding decisions and operator inputs

These do not block local task-zero fixes, fixtures, schema design, or UI prototypes. They do block the particular production operations that depend on them.

| Input / decision | Proposed default or next step |
|---|---|
| Actual deployed revision and migration ledger | Inspect before preparing production SQL |
| PostgreSQL version, size, extensions, backup/PITR availability | Inventory through authorized environment access; do not assume Railway plan features |
| Girlfriend's account identifier and source-data expectations | Resolve privately; do not put personal identifiers in public docs |
| Browser-only preference capture | Export from the actual browser before relying on server backup |
| Unknown metadata/status/unit anomalies | Preserve raw values and report; adjudicate before cutover |
| Cutover maintenance window | Prefer a short write pause for first migration; rehearse duration |
| Community contribution policy | Existing/private by default, explicit opt-in; proposed minimum five contributions |
| Rating conflicts after duplicate collapse | Preserve all source values; reviewed current rating selection |
| Concurrent formats on one read | Initial one open attempt with explicit format changes; retain legacy copy details |
| Goal calculation compatibility | Preserve existing target and old interpretation; label new logged metrics separately |
| Backup retention / recovery target | Set after measured restore drill and storage availability |
| Production rollout approval | Request when tested artifacts, reconciliation, and rollback procedure are concrete |

## 23. Suggested kickoff instruction for Codex

> Use this brief as the master specification for Basgiath v2. First inspect the checkout, applicable repository instructions, and current tests. Confirm the metadata import defect and ownership defects, then implement focused fixes with regression coverage. Establish a reproducible baseline and prepare safe backup/restore and migration tooling against isolated data. Preserve the existing production schema and every personal record. Continue through the phased milestones in small reviewable changes, keeping a checklist and decision log. Treat canonical works, personal reading history, and data reconciliation as foundations for the UI. Build no native iOS client. Do not run production migrations, replacement imports, or cutover until their required access, evidence, and authorization are in place. Never claim a backup, test, migration, or rollback succeeded unless it was actually executed and verified.

## 24. Sources and evidence scope

Primary source is the local repository at the revision recorded above, particularly `shared/schema.ts`, `src/lib/data-fns.ts`, the store/preferences helpers, catalog integration, routes, package configuration, migration files, and deployment entry points. Three independent read-only repository audits covered data safety, architecture/catalog/auth, and UI semantics. Application code and production data were not modified during this brief's preparation.

Product context comes from the retrieved ChatGPT conversation “Plan App Improvements” and the current user's explicit scope. Provider behavior was checked against the official Open Library and Google Books documentation linked in section 7. Recheck external API limits and exact framework adapter syntax at implementation time. The proposed schema, service boundaries, targets, filenames, release policy, and task sequence are engineering recommendations, not claims that those facilities already exist.
