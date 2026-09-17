# Rowan refinement status — September 16, 2026

This supersedes historical pending-feature lists in BUILD_STATUS.md and CHECKLIST.md. The September 12 scope reduction remains in effect: no ratings, tags, social/community features, Home redesign, or global catalog merge project.

## Implemented

- Latest UI refinements: Calendar has its SVG icon; Insights keeps period controls in a stable row; book headers use a subtle cover tint over the theme surface with theme foreground text; mobile navigation sits 4px from the bottom with safe-area padding inside the bar. The Shelves-only dropdown is removed and New shelf has one plus icon without the native disclosure triangle.
- Flexible goals add different books, authors, recorded timer minutes, reading days, and named custom measures with dated positive/negative entries. Daily and no-deadline periods join the existing periods. Custom entries are owner-scoped and retry-safe, survive goal edits, and round-trip through archive version 7 (older archives still import). Apply additive migration `0010_flexible_goals` through the configured Rowan migration runner; it adds only a private details table and does not rewrite existing goals.
- Library queries apply search, status, format, author, completion year, favorites, read history, shelf/series/queue membership and ordering before returning 24 books. Numbered pages replace the previous load-more flow; filters reset the page and switching display modes preserves it. Out-of-range bookmarked pages return to the last available page. Author/year choices cover the full account.
- Collections restores direct Series / Queue / Shelves tabs, with the existing series and queue management visible immediately. Shelf browsing uses paged grid/list/spines; the all-shelves view queries each shelf independently for a bounded preview with an Open shelf link. This prevents a global library page from hiding shelf members. Shelf membership additions have a separate paged library search. Existing collections and book IDs remain intact.
- Expanded Library filters have labeled responsive fields, separate quick filters, a close control and a reset action. Grid/list views and numbered pagination remain available.
- Goals show progress, remaining amounts, period dates, contributing reads and missing-data notices, with weekly/monthly/yearly or specific-year targets, presets, editing and deletion. Completed reads (including rereads) count in the reader's time zone; Sunday remains the start of a week. Page totals use completed attempt lengths. The legacy `minutes` metric retains its original **audiobook hours** meaning, now labeled clearly; it does not count timer sessions. The flexible-goals extension above adds the new metrics and migration.
- Insights and Library completion years use the device time zone, matching the calendar. Insights is a retrospective: monthly completion chart, distinct books/authors, months with a finish, recent finishes, and longest completed book using that reading attempt's length. Goal inputs and target percentages live only in Goals. Undated reads remain preserved and are explicitly excluded from annual charts.
- Insights adds an All Time view with reread counts, known/unknown-date handling and recorded timer duration. Undated completions contribute to all-time totals, never invented calendar activity. Monthly patterns across all years are labeled accordingly.
- Calendar day details include notes and quotes at their original creation dates. Deleted margins are omitted; ownership is checked through the saved book, and calendar responses do not include private margin text.
- Active Library filters remain visible as removable chips when the panel is closed. Margins uses a searchable, paged book picker for both filtering and composition instead of loading every library page into a dropdown.
- Margin and book edits warn before route navigation, reload or close. This is a navigation guard, not disk-backed autosave or offline support.
- The exact supplied PNG remains the brand asset. Header/sidebar backing follows the selected theme's primary color; the fixed burgundy background and unused approximate SVG are removed. The manifest has its own MIME type and no longer advertises the transparent icon as maskable.
- Server failures carry a generated request ID and safe status/duration logs; the server no longer consumes a global recent error from another request.

## Evidence and limits

Synthetic database tests cover a 1,000-book account, owner isolation, pagination, shelf/queue ordering and a Chicago New Year boundary. Existing archive restore, rollback, organization and shelf tests exercise portable-data recovery locally.

Executed: 10 account/archive/organization/shelf tests passed, followed by 21 browse/reading-service tests. Rowan TypeScript passed. Desktop and 390px mobile signed-out shell/logo were visually inspected in the local browser; authenticated Library/draft flows were not browser-verified.

September 16 follow-up: 24 focused goal, browsing and reading-service tests passed, covering cross-page shelf membership, owner isolation, goal period/DST boundaries, all-time undated reads, and calendar margin deletion/privacy. The changed authenticated screens still need browser review; prior signed-out shell screenshots are not evidence for these changes.

These checks do not demonstrate production PostgreSQL latency, multi-connection load, or a restored Railway backup. The collection management service still returns its existing organization inventory; it has not been redesigned for tens of thousands of series members. Concurrent edits between offset pages may require refreshing the list.

Actual Railway backup/PITR configuration, a restore into an isolated PostgreSQL instance, per-user reconciliation and measured restore time remain unverified. Do not overwrite the live database for a rehearsal. The operator should use a separate restore target, confirm its identity, compare books/reads/margins/settings, then record the result here without secrets or personal data.

Native iOS/Live Activities, offline synchronization and versioned public HTTP adapters remain deferred. Flexible goals require migration `0010_flexible_goals`; other UI refinements do not change the schema.
