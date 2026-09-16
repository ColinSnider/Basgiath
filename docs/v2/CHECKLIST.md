# Rowan v2 scaffold checklist

Current status: [September 15 refinement report](REFINEMENT_STATUS.md). Treat the historical checklist below as background, not the current backlog.

This checklist tracks architecture work before production implementation. It is intentionally separate from the v1.1 release checklist.

## Working code checkpoint

- [x] Local `codex/rowan-v2-foundation` branch
- [x] Catalog and reading tables in a separate `v2` schema
- [x] Reviewed first migration applied to an isolated test database only
- [x] Owner-scoped library/reading service operations
- [x] Atomic idempotency receipts and version checks
- [x] Provider search/lookup adapter and fixture tests
- [x] Database-backed lifecycle and legacy-preservation tests
- [x] Rowan Library and reading controls wired to v2 services behind a development gate
- [x] Standalone Rowan app entry, authentication database, build, and Railway configuration
- [ ] Production backfill and activation

See [build status](BUILD_STATUS.md) for limits. The complete domain and operational checklist remains below.

## Decisions

- [ ] Rowan display name / Basgiath compatibility boundary
- [ ] Work versus edition identity rules
- [ ] Reading session and progress event semantics
- [ ] Rating privacy and aggregate threshold
- [ ] Legacy duplicate conflict policy
- [ ] Service/API contract versioning
- [ ] Backup, cutover, and rollback policy
- [ ] Calibre metadata/export boundary

## Contracts

- [ ] Catalog DTOs
- [ ] Personal library DTOs
- [ ] Reading lifecycle commands
- [ ] Margin and archive contracts
- [ ] Stable error codes
- [ ] Actor/ownership contract
- [ ] Provider adapter contract

## Data

- [ ] Legacy schema inventory
- [ ] Source-record capture format
- [ ] Additive v2 schema design
- [ ] Deterministic mapping IDs
- [ ] Reconciliation report format
- [ ] Final-delta strategy
- [ ] Migration resume and idempotency tests

## UI

- [x] Home Last / Current / Next
- [ ] Library overview
- [ ] All Books search/filter/sort
- [ ] List/grid/bookshelf parity
- [x] Real shelves: create, rename, membership, library filter
- [ ] Work-first detail / edition secondary
- [x] Recorded reading history and monthly calendar
- [ ] Series tracking
- [ ] Margins expansion
- [x] Favorites and private half-star ratings
- [ ] Contextual community rating
- [ ] Insights and goals

## Operations

- [ ] Isolated backup restore
- [ ] Shadow reads
- [ ] Feature flags and account authority
- [ ] Mutation journal/replay
- [ ] Stale-client blocking
- [ ] Health, error, provider, and migration metrics
- [ ] Cutover rehearsal
- [ ] Rollback rehearsal

## Deferred integrations

- [ ] Calibre metadata export design
- [ ] Local bridge threat model
- [ ] User-owned file handoff design
- [ ] Sync conflict UI
- [ ] Native iOS API consumer
