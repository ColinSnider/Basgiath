# Rowan data controls

Rowan settings and data controls operate on `ROWAN_DATABASE_URL`. Authentication continues through the existing account. These operations do not write to the source Basgiath database.

## What is implemented

- Settings in Rowan: dark mode, preset accent, compact layout, text size.
- Personal title, author, cover, and metadata editing; edition format/length retains the existing session-snapshot behavior.
- Goal creation, editing and deletion, including calendar-year goals.
- Permanent book deletion with stale-version protection. Personal sessions, progress, margins, ratings, shelf membership and legacy audit copies are removed together. Shared catalog entries remain.
- Full Rowan clear and archive replacement with explicit confirmation.
- Rowan v2 archive validation and transactional restore, including works, editions, reading sessions, progress, ratings, margins, shelves, goals and settings. Older archives without a margin kind remain readable.
- Legacy ratings and note/quote types translate into their native Rowan fields.

## Mirror behavior

`v2.account_state` retains deletion exclusions and whether the reader has edited their settings. The mirror and mutations share the same per-user transaction lock. Deleted books/goals do not return during ordinary refresh. Personal book corrections live on the user's book record and never modify a shared work.

Clear and archive replacement pause automatic mirroring for that account. This prevents the next page load from immediately restoring the old source library over the user's explicit choice. The UI states this before confirmation and displays the paused state afterward. There is deliberately no automatic re-enable following restore.

## Archive semantics

Restore **replaces** the signed-in reader's Rowan library; it is not a merge. The UI validates and previews the file, then requires `RESTORE`. The server independently validates size, version, field types, owners, unique IDs, memberships and references before deletion. Any SQL error rolls back the replacement. Repeated requests with the same mutation key do not repeat it.

IDs are remapped. Source account IDs are not trusted as the destination owner. Catalog records become detached copies so an archive cannot overwrite another reader's catalog. Provider mappings are retained in `legacyMetadata.archiveCatalogMappings`; saving that provider result again resolves the reader's restored book without creating another membership. Those imported mappings are not promoted into trusted global provider identities. The original Basgiath importer remains the entry point for v1 JSON exports.

## Deployment and verification

The `migrations-v2/meta/_journal.json` entries for `0003_legacy_sync_snapshots` and `0004_account_state` are required. `0004` also adds margin kind. The normal server startup applies the registered migrations before accepting requests. Do not deploy the code alone while skipping migrations.

`server/v2/account-service.test.ts` uses isolated PGlite PostgreSQL and the actual v2 migration journal. It covers migration registration/replay, ownership, mirror preservation, retry behavior, stale deletes, archive relationship remapping, old archives, provider reuse and rollback after an injected failure. No production data is used.

Local validation does not replace a staging browser check: save settings, edit a book, export, preview/restore the export, and verify the library and reading history after refresh.
