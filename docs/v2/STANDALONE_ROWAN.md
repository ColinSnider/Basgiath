# Standalone Rowan

Rowan now has a separate TanStack application in `apps/rowan`. Its `/` opens Rowan, `/login` owns sign-in and registration, and other Basgiath routes are absent. It shares the implemented Rowan components and services with the compatibility `/rowan` screen; it does not mount Basgiath's root, navigation, or library store.

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

`npm run build:rowan` produces `dist-rowan/`; `npm run start:rowan` serves it. `npm run typecheck:rowan` checks this application's route types separately. Existing Basgiath build/start commands and `dist/` remain available.

## Independence and compatibility

- Authentication and library operations both use `ROWAN_DATABASE_URL`. Standalone mode never falls back to `DATABASE_URL`.
- Sessions use the separate `rowan:session` browser key. Basgiath keeps `basgiath:session`.
- Standalone requests skip legacy import. The legacy synchronization panel is absent and its endpoints reject standalone calls.
- New accounts can save books immediately without copying IDs from Basgiath.
- Public account/settings/goal table names remain compatible with existing services. Bootstrap currently also creates the unused legacy book/margin tables; physical schema cleanup is deferred.
- Bootstrap runs explicitly, never at standalone server startup. The v2 migrations have their own `rowan_migrations` journal so legacy timestamps cannot skip them.
- This bootstrap command targets a fresh standalone database. Do not apply it to an existing paired Rowan database with an older migration ledger without first reconciling that ledger.

## Railway

Create a separate Rowan service from this repository and select `/railway.rowan.json` as its configuration file. Attach a dedicated database through `ROWAN_DATABASE_URL` and set the staging/provider variables above. Run the explicit bootstrap once before serving accounts. The configuration builds and starts the standalone artifact and uses `/healthz` for process health; that endpoint does not verify database readiness.

No Railway service, database, domain, production deployment, or account migration was changed by this implementation. Existing Rowan/Basgiath records are not automatically transferred. A reviewed archive transfer or migration remains separate work.

## Remaining product work

Rowan now has dedicated Home, Library, Search, Calendar, Insights, Goals, Margins, and Settings routes. The persistent shell retains pending mutation retries and open book details across navigation. Only the selected feature renders; library/catalog queries are enabled on their respective pages. Theme application lives in the shell, independent of Settings. Book detail has been extracted into its own component.

Next: persist library filters/sort/pagination in the URL, extract the remaining library/search controls into smaller components, and verify authenticated browser workflows against staging PostgreSQL. Production account migration, reconciliation, and recovery gates from the implementation brief still apply.

## Validation for this slice

- Both application builds and both TypeScript checks passed.
- Four focused tests passed, including database selection, staging activation, and a fresh PGlite account saving a book without legacy import. The v2 migration journal was exercised twice for repeatability; PGlite installed the legacy SQL through its multi-statement execution API.
- A built-server HTTP smoke test returned Rowan pages at `/` and `/login`, and 404 at `/library`, with an unreachable dummy database URL and no startup migrations.
- Browser sign-up against a live PostgreSQL instance and Railway deployment remain untested.

Run `npm run test:rowan:routes` after `npm run build:rowan` to check all eight built SSR page routes and legacy-route exclusion without a live database.
