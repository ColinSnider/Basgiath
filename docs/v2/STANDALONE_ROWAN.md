# Standalone Rowan

Rowan is the default application in `apps/rowan`. Its `/` opens Home, `/login` owns sign-in and registration, and every feature has its own route component. The persistent shell renders an Outlet; Library, Search, and book details load independently. There is no static HTML interception or compatibility `/rowan` screen.

## Run locally

Use a **dedicated, empty staging PostgreSQL database**. Export these variables in your shell (Railway service variables provide the equivalent):

```sh
export ROWAN_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/rowan'
export ROWAN_V2_ENABLED=true
export ROWAN_V2_ENV=staging
export OPEN_LIBRARY_USER_AGENT='Rowan staging (your real contact address)'
npm run db:migrate:rowan
npm run dev:rowan
```

Open the displayed local URL and create a Rowan account. Google Books remains optional through `GOOGLE_BOOKS_ENABLED` and `GOOGLE_BOOKS_API_KEY`.

`npm run dev`, `npm run build`, and `npm start` now select Rowan. The explicit `:rowan` commands are equivalent. Builds produce `dist-rowan/`. `npm run typecheck:rowan` checks the application's route types. The old app is available only through `dev:legacy`, `build:legacy`, and `start:legacy`.

## Independence and compatibility

- Authentication and library operations both use `ROWAN_DATABASE_URL`. Standalone mode never falls back to `DATABASE_URL`.
- Sessions use the separate `rowan:session` browser key. Basgiath keeps `basgiath:session`.
- Standalone requests skip legacy import. The legacy synchronization panel is absent and its endpoints reject standalone calls.
- New accounts can save books immediately without copying IDs from Basgiath.
- Public account/settings/goal table names remain compatible with existing services. Bootstrap currently also creates the unused legacy book/margin tables; physical schema cleanup is deferred.
- Bootstrap runs explicitly, never at standalone server startup. The v2 migrations have their own `rowan_migrations` journal so legacy timestamps cannot skip them.
- This bootstrap command targets a fresh standalone database. Do not apply it to an existing paired Rowan database with an older migration ledger without first reconciling that ledger.

## Railway

Both `railway.json` and `railway.rowan.json` build and serve Rowan at the domain root. Attach a dedicated database through `ROWAN_DATABASE_URL` and set the staging/provider variables above. Run the explicit bootstrap once before serving accounts. The configuration uses `/healthz` for process health; that endpoint does not verify database readiness.

No Railway service, database, domain, production deployment, or account migration was changed by this implementation. Existing Rowan/Basgiath records are not automatically transferred. A reviewed archive transfer or migration remains separate work.

## Remaining product work

Rowan has dedicated Home, Library, Search, History, Insights, Goals, Margins, and Account routes. Each URL mounts its own component inside the shared shell. Library and catalog queries only exist on their respective pages. Settings are part of Account; `/settings` sends an HTTP redirect to `/account`. Theme application lives in the shell. Books open at `/books/$bookId`, loading the owned record directly rather than depending on a previous page's selection state. Mobile navigation has five tabs: Home, Library, Search, History, and Account.

Next: persist library filters/sort/pagination in the URL and verify authenticated browser workflows against staging PostgreSQL. Production account migration, reconciliation, and recovery gates from the implementation brief still apply.

## Validation for this slice

- Default production build and Rowan TypeScript check passed.
- All 20 reading-service tests passed with isolated PGlite, including owner-only direct book lookup and missing-book handling.
- Built SSR checks verify nine distinct page headings and titles, `/profile` returning 404, and `/settings` redirecting to `/account`.
- Local browser checks verified the signed-out desktop shell, five mobile tabs at 390px, navigation, Account reload, and browser Back. No console errors were captured during these checks.
- Authenticated browser workflows and Railway deployment remain untested. The local shell preview uses an unreachable dummy database; it does not prove account or provider connectivity.

Run `npm run test:rowan:routes` after `npm run build` to check the built SSR routes without a live database.

## Series and existing accounts — September 10, 2026

Library now includes **Series & queue**. Readers can create and rename private series,
order volumes, label novellas and optional entries, declare ongoing/unknown/full coverage,
and queue the next unread volume. Book pages expose membership and queue actions alongside
edition facts, completed reads, margins, and an editable synopsis. Home prioritizes the
pinned book and then the curated queue. Starting a book removes it from the upcoming queue.
Series progress retains completed reads during a reread.

Rowan archives now export version 4 with series, memberships, and reading queue. Versions
2 and 3 remain readable. Restore remaps ownership and book/series IDs transactionally;
clear and book deletion also remove the relevant organization records.

For the existing two-reader installation, retain DATABASE_URL as the original account
and source database, use a migrated ROWAN_DATABASE_URL target, and set
ROWAN_EXISTING_ACCOUNTS=true with ROWAN_STANDALONE=true. The original login/session store
is retained. The first authenticated data request translates that reader's legacy books,
history, ratings, margins, goals, and saved settings, then marks Rowan authoritative in
the same transaction. Later requests skip the translation. Conflicting target account
identities are rejected, and legacy source data is not deleted. Existing standalone
installs can leave ROWAN_EXISTING_ACCOUNTS=false and translate their local legacy tables.
Browser-only preferences cannot be recovered from the database.

This implements the application path, not the hosted rollout. Target migrations must be
applied before switching traffic. No deployment or real-account migration was run in
this development session; authenticated browser verification remains outstanding.
