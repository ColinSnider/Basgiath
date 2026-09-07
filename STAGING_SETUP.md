# Staging Setup

This guide documents how to stand up a staging/demo environment for Basgiath so the `codex/rowan-v2-foundation` branch can be tested in isolation before it is merged into `main`.

---

## Environment structure

| | Production | Staging |
| --- | --- | --- |
| Branch | `main` | `codex/rowan-v2-foundation` |
| Database | Production Postgres service | Dedicated staging Postgres service |
| Domain | Production domain | Separate staging domain |
| Railway environment | `production` | `staging` |

Production and staging are fully isolated: separate services, separate databases, separate domains. Nothing deployed to staging can affect production data or traffic.

---

## Manual setup steps (Railway)

1. **Create a new environment**
   - In the existing Railway project, open the environment switcher and create a new environment named `staging`.
   - Railway will offer to clone service configuration from `production` — this is fine as a starting point, but the variables below must be updated to point at staging-only resources.

2. **Add a staging Postgres service**
   - In the `staging` environment, add a new **Postgres** service (Add Service > Database > PostgreSQL).
   - Do not reuse or reference the production Postgres service — this must be a distinct database with its own volume.

3. **Add a staging Basgiath service**
   - Add a new service in the `staging` environment from the same GitHub repository (`ColinSnider/Basgiath`).
   - Give it a clear name, e.g. `basgiath-staging`.

4. **Configure the branch to deploy**
   - In the staging service's Settings > Source, set the branch to `codex/rowan-v2-foundation`.
   - Confirm automatic deploys are enabled so new commits to that branch redeploy staging.

5. **Set `DATABASE_URL` to the staging Postgres**
   - Reference the staging Postgres service's connection string, e.g. using a Railway variable reference: `${{Postgres-staging.DATABASE_URL}}` (adjust to the actual staging Postgres service name).
   - Double-check this does **not** point at the production Postgres service.

6. **Add a public domain**
   - In the staging service's Settings > Networking, generate or attach a public domain (e.g. a Railway-provided `*.up.railway.app` domain) so the environment is reachable for manual testing.

7. **Set environment variables**
   - Mirror the same variables used in production (see checklist below): `AUTH_BCRYPT_ROUNDS`, `AUTH_SESSION_EXPIRY_DAYS`, and any other app-specific variables.
   - `DATABASE_URL` should point at the staging Postgres from step 5, not production.

8. **Run database migrations on staging**
   - As with production, run migrations as a one-off step, not as part of the service start command:
     ```bash
     npm run db:migrate
     ```
   - Run this against the staging `DATABASE_URL` (e.g. via `railway run --environment staging npm run db:migrate` or a one-off Railway job scoped to the `staging` environment).

---

## How to test

Once staging is deployed and reachable at its public domain:

- **Deploy to staging** — push or merge changes into `codex/rowan-v2-foundation`; confirm the staging service picks up the new deploy.
- **Test the auth flow**:
  - Sign up a new account.
  - Log out and log back in.
  - Confirm session behavior (expiry, guest browsing) matches expectations documented in `AUTH_FLOW.md`.
- **Test new features** introduced on `codex/rowan-v2-foundation` that aren't yet on `main`.
- **Test database operations** — creating/editing/deleting books, margins, goals, and settings; verify data persists correctly in the staging Postgres.
- **Test data isolation** — confirm that data created in staging (users, books, sessions, etc.) does not appear in production, and vice versa. Query each database independently if needed to verify no shared state.

---

## How to promote to production

1. Once staging testing passes, open (or update) a pull request merging `codex/rowan-v2-foundation` into `main`.
2. Merge the pull request. Production's `main`-tracked service automatically redeploys.
3. Monitor the production deployment:
   - Watch the Railway deploy logs for build/start errors.
   - Verify health checks (`GET /healthz`, `GET /readyz`) return healthy after deploy.
   - Spot-check the auth flow and core features in production after rollout.
4. Once production is confirmed stable, the staging environment can be left running for future testing or torn down if no longer needed.

---

## Environment variables checklist

Set these on the staging Basgiath service (values should mirror production unless noted):

- `DATABASE_URL` — connection string for the **staging** Postgres service (must not point at production).
- `AUTH_BCRYPT_ROUNDS` — bcrypt cost factor for password hashing (default: `10`).
- `AUTH_SESSION_EXPIRY_DAYS` — number of days a session token remains valid (default: `7`).

Any additional variables used in production should be added here as well, using staging-appropriate values where relevant (e.g. staging domains, staging-only feature flags).
