# Rowan refinement status — September 15, 2026

This supersedes historical pending-feature lists in BUILD_STATUS.md and CHECKLIST.md. The September 12 scope reduction remains in effect: no ratings, tags, social/community features, Home redesign, or global catalog merge project.

## Implemented

- Library queries apply search, status, format, author, completion year, favorites, read history, shelf/series/queue membership and ordering before returning 24 books. Load more is explicit. Author/year choices are queried across the full account, independent of the displayed page.
- Collection browsing uses the same paged results for grid/list/spines. Shelf membership additions have a separate paged library search, so books outside the selected shelf can still be added. Existing collections and book IDs remain intact.
- Insights and Library completion years use the device time zone, matching the calendar. Insights includes lifetime completions, undated reads, saved timer hours, favorites, longest book and authors of favorites. Timer totals do not estimate unsaved active timer time.
- Margin and book edits warn before route navigation, reload or close. This is a navigation guard, not disk-backed autosave or offline support.
- The exact supplied PNG remains the brand asset. Header/sidebar sizing and burgundy backing were refined; the unused approximate SVG was removed. The manifest is served with its own MIME type and no longer advertises the transparent icon as maskable.
- Server failures carry a generated request ID and safe status/duration logs; the server no longer consumes a global recent error from another request.

## Evidence and limits

Synthetic database tests cover a 1,000-book account, owner isolation, pagination, shelf/queue ordering and a Chicago New Year boundary. Existing archive restore, rollback, organization and shelf tests exercise portable-data recovery locally.

Executed: 10 account/archive/organization/shelf tests passed, followed by 21 browse/reading-service tests. Rowan TypeScript passed. Desktop and 390px mobile signed-out shell/logo were visually inspected in the local browser; authenticated Library/draft flows were not browser-verified.

These checks do not demonstrate production PostgreSQL latency, multi-connection load, or a restored Railway backup. The collection management service still returns its existing organization inventory; it has not been redesigned for tens of thousands of series members. Concurrent edits between offset pages may require refreshing the list; loaded IDs are deduplicated.

Actual Railway backup/PITR configuration, a restore into an isolated PostgreSQL instance, per-user reconciliation and measured restore time remain unverified. Do not overwrite the live database for a rehearsal. The operator should use a separate restore target, confirm its identity, compare books/reads/margins/settings, then record the result here without secrets or personal data.

Native iOS/Live Activities, offline synchronization and versioned public HTTP adapters remain deferred. No database schema change is required for this refinement.
