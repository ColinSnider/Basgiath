# ADR 0001: Rowan naming and external-library integration boundary

**Status:** accepted for planning  
**Date:** 2026-09-05

## Decision

Rowan is the future user-facing product name. Basgiath remains the internal repository and compatibility name during v2 development. New UI branding is centralized and introduced deliberately; existing database identifiers, local-storage keys, URLs, package names, and historical references remain stable.

Calibre synchronization is a future optional integration. Initial v2 does not download, host, or redistribute book files. The first useful integration is an explicit metadata/export bridge for books and editions the user selects. Any later local bridge must be opt-in, dry-run first, authenticated, idempotent, auditable, and clear about source-of-truth conflicts.

## Context

Issue #46 proposes “automate downloading books and sync to calibre,” but supplies no technical or licensing requirements. Rowan's v2 plan prioritizes canonical catalog identity, personal reading history, margins, shelves, ratings, and safe migration. A downloader would add a separate security, copyright, filesystem, and synchronization problem.

## Consequences

- Internal renaming can happen later with compatibility aliases and a deliberate migration.
- UI code gets a stable brand boundary rather than scattered string literals.
- Catalog and reading services remain useful without Calibre or local files.
- A future integration can bind external items to `user_books` without making an external library the canonical identity.
- The integration must define ownership, conflict policy, and user-controlled scope before implementation.

## Rejected for the scaffold phase

- Global Basgiath → Rowan replacement.
- Automatic downloads from unknown or third-party sources.
- Storing book files in Railway/PostgreSQL.
- Treating Calibre IDs as work or edition IDs.
- Silent two-way sync or overwrite of reading state.
- Making issue #46 a dependency of the v2 catalog rebuild.
