# Auth Flow

All authentication is self-contained. There are no external API calls, no OAuth providers, no third-party session stores. Every user record, hashed password, and session token lives exclusively in Postgres.

---

## Auth-related files

| File                       | Role                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `src/lib/auth-fns.ts`      | TanStack Start server functions — all auth logic runs here on the server                   |
| `src/lib/auth-context.tsx` | React context — wraps the app, exposes `login`, `register`, `logout`, and the current user |
| `src/lib/session-auth.js`  | Shared auth/session helpers for guest sessions, protected-action checks, and guard logic   |
| `src/lib/auth-config.ts`   | Environment-driven configuration (`AUTH_BCRYPT_ROUNDS`, `AUTH_SESSION_EXPIRY_DAYS`)        |
| `src/routes/login.tsx`     | Login / signup UI — single page that toggles between the two modes                         |
| `server/db.ts`             | Postgres connection via `node-postgres` + Drizzle ORM                                      |
| `shared/schema.ts`         | Drizzle table definitions: `users`, `sessions`, `userSettings`, and all other tables       |

---

## Database tables (auth-relevant)

```
users
  id           serial PRIMARY KEY
  username     text UNIQUE NOT NULL          -- stored lowercase
  password     text                          -- bcrypt hash
  display_name text NOT NULL DEFAULT 'Reader'
  email        text
  created_at   timestamp DEFAULT now()

sessions
  id           text PRIMARY KEY              -- UUID v4
  user_id      integer REFERENCES users(id) ON DELETE CASCADE
  expires_at   timestamp NOT NULL

user_settings
  user_id      integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
  dark_mode    boolean DEFAULT false
  accent_color text    DEFAULT 'default'
  compact_mode boolean DEFAULT false
  font_scale   text    DEFAULT 'md'
```

---

## Signup flow

1. User fills in **username**, **password**, **displayName** (optional, defaults to username), and **email** (optional) on `/login` and submits the "Create Account" form.
2. `src/routes/login.tsx` calls `register()` from `auth-context.tsx`, which calls the `register` server function in `auth-fns.ts`.
3. Server validates input with Zod (`username` ≥ 3 chars, `password` ≥ 6 chars).
4. Queries `users` table to confirm the username is not already taken (case-insensitive — username is lowercased before every read/write).
5. Hashes the password with `bcryptjs.hash(password, authConfig.bcryptRounds)`. `bcryptRounds` defaults to `10` and is overridable via the `AUTH_BCRYPT_ROUNDS` environment variable.
6. Inserts a new row into the `users` table. Only the explicitly selected public columns are returned (guards against stale schema columns).
7. Inserts a default row into `user_settings` for the new user.
8. Generates a session token with `crypto.randomUUID()`.
9. Inserts the token into the `sessions` table with `expires_at` set to `now + AUTH_SESSION_EXPIRY_DAYS` days (default: 7).
10. Returns `{ sessionId, user }` to the client.
11. `auth-context.tsx` writes `sessionId` to `localStorage` under the key `basgiath:session`, sets React state, and the router navigates to `/`.

---

## Login flow

1. User fills in **username** and **password** on `/login` and submits the "Sign In" form.
2. `src/routes/login.tsx` calls `login()` from `auth-context.tsx`, which calls the `login` server function in `auth-fns.ts`.
3. Server validates input with Zod.
4. Queries `users` table by lowercased username, selecting the credential columns (includes `password` hash).
5. If no user is found, throws `"Invalid username or password"` (deliberately ambiguous).
6. Compares the submitted password against the stored hash with `bcryptjs.compare()`. Throws the same ambiguous error on mismatch.
7. Generates a new session token with `crypto.randomUUID()`.
8. Inserts the token into the `sessions` table with a fresh expiry.
9. Returns `{ sessionId, user }` (without the password hash — only public columns).
10. `auth-context.tsx` writes `sessionId` to `localStorage`, sets React state, and the router navigates to `/`.

---

## Session validation flow (app load)

1. On mount, `AuthProvider` in `auth-context.tsx` reads `localStorage.getItem("basgiath:session")`.
2. If nothing is stored, `loading` is set to `false` and the user is treated as unauthenticated.
3. If a value is found, it calls the `getMe` server function with the stored `sessionId`.
4. If the value is a guest session token (`guest:<expiresAtMs>:<nonce>`), the shared auth layer validates expiry and returns a guest user object (`@guest`) without touching the database.
5. For non-guest sessions, server queries the `sessions` table by `id`. If no row exists, returns `null`.
6. Checks `session.expiresAt < new Date()`. If expired, returns `null`.
7. Queries the `users` table by `session.userId`, returning only public columns.
8. If the user row is missing (e.g. deleted), returns `null`.
9. On `null` response (or any error), `auth-context.tsx` removes the key from `localStorage` and leaves the user unauthenticated.
10. On a valid response, sets `user` and `sessionId` in React state — the app renders as authenticated.

---

## Logout flow

1. User triggers logout (e.g. via a UI button that calls `logout()` from `useAuth()`).
2. `auth-context.tsx` reads `sessionId` from `localStorage`.
3. For full-auth sessions, it calls the `logout` server function, which deletes the matching row from the `sessions` table (`DELETE FROM sessions WHERE id = ?`).
4. For guest sessions, it skips the server call and only clears local state.
5. `auth-context.tsx` removes `basgiath:session` from `localStorage` and clears `user` / `sessionId` from React state.
6. The app re-renders as unauthenticated; the router redirects to `/login`.

---

## Guest browse flow

1. On `/login`, the user can choose **Continue as Guest**.
2. `auth-context.tsx` creates a guest session token via the shared auth layer and stores it under `basgiath:session`.
3. `getMe` validates the guest token expiry and returns a guest user payload.
4. Route guards treat a valid guest user as signed in for browsing.
5. Protected write actions (books, margins, goals, settings, account updates) are blocked with: `"Sign in or create an account to save changes."`

---

## Profile update flows

These follow the same session-first pattern: every mutating server function re-validates the session before touching user data.

- **`updateDisplayName`** — verifies session, updates `users.display_name`, returns new value.
- **`updateEmail`** — verifies session, updates `users.email`, returns new value.
- **`changePassword`** — verifies session, re-checks the current password with `bcryptjs.compare`, hashes the new password, updates `users.password`.

---

## No external dependencies

| Concern                      | Implementation                                             |
| ---------------------------- | ---------------------------------------------------------- |
| Password hashing             | `bcryptjs` — pure JS, runs in-process, no network calls    |
| Session tokens               | `crypto.randomUUID()` — Node.js built-in, no network calls |
| Session storage              | Postgres `sessions` table only                             |
| User storage                 | Postgres `users` table only                                |
| OAuth / SSO                  | None                                                       |
| External auth services       | None                                                       |
| External password validation | None                                                       |
| Email verification           | None (email is stored but not verified)                    |

The only outbound connection the server makes is to the Postgres instance specified by `DATABASE_URL`.
