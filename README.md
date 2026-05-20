# Basgiath

Basgiath is a full-stack TypeScript reading companion for tracking books, reading progress, notes, and goals.

## Stack

- React 19 + TypeScript
- TanStack Router + TanStack Start
- Tailwind CSS
- Drizzle ORM + PostgreSQL

## Features

- Username and password authentication
- Reading dashboard and personal library
- Book detail tracking for books and audiobooks
- Margins (quotes and notes)
- Reading goals
- Account and appearance settings
- JSON import/export for user data and settings
- Custom fonts, expanded theme colors, and custom themes
- Modular homepage widgets with editable 2-column layout

## Project structure

```text
.
├── server/            # Database setup and server-only modules
├── shared/            # Shared Drizzle schema/types
├── src/
│   ├── components/    # Reusable UI components
│   ├── lib/           # Client/server shared app logic
│   └── routes/        # TanStack file-based routes
├── drizzle.config.ts
├── serve.mjs          # Node production entrypoint
├── vite.config.ts
└── package.json
```

## Requirements

- Node.js 22.12+
- npm
- PostgreSQL

## Setup

```bash
git clone https://github.com/ColinSnider/Basgiath.git
cd Basgiath
npm install
```

## Environment variables

Create a `.env` file (or set environment variables another way):

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME
PORT=5000
NODE_ENV=production
```

- `DATABASE_URL` is required.
- `PORT` is optional in local development and is provided automatically by Railway.

## Scripts

- `npm run dev` - Start local development server
- `npm run build` - Build client and server bundles
- `npm run build:dev` - Build with development mode
- `npm run start` - Run production server from `dist/`
- `npm run preview` - Preview Vite build output
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run db:push` - Push Drizzle schema to the configured database

## Local development

1. Ensure PostgreSQL is running and `DATABASE_URL` is set.
2. Push schema changes if needed:

   ```bash
   npm run db:push
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

The app runs on `http://localhost:5000` by default.

## Settings data and personalization

- **Data export/import** (Settings > Data):
  - Export your books, margins, goals, app settings, and UI preferences as JSON.
  - Import a JSON export to restore app state.
  - Imports validate shape and provide actionable errors when fields are missing or malformed.
- **Font settings**:
  - Toggle custom fonts on/off.
  - Configure body and display font selections.
- **Appearance themes**:
  - Choose from expanded preset accent themes.
  - Create and apply custom themes with user-defined colors.
- **Homepage widgets**:
  - Edit widget visibility/order/size in a 2-column grid.
  - Widgets support half-width and full-width layout options and are persisted per user.

## Production

```bash
npm run build
npm run start
```

## Railway deployment

1. Create a new Railway project and connect this repository.
2. Add a PostgreSQL service and copy its `DATABASE_URL` into the app service variables.
3. Deploy. Railway uses `railway.json`:
   - Build: Railpack (`npm install` + `npm run build`)
   - Start: `npm run start`
4. Run database migrations as a separate step before or after the first deploy. Do not include migrations in the web service start command. Use a one-off Railway job or run the command manually:
   ```bash
   npm run db:migrate
   ```
5. Verify health checks:
   - `GET /healthz`
   - `GET /readyz`

## Troubleshooting

- `DATABASE_URL must be set`: set `DATABASE_URL` on the app service before deploying.
- Migration errors: run `npm run db:migrate` as a separate one-off job or manual step, not as part of the web service startup.
- App does not bind correctly: ensure Railway `PORT` is not overridden with an invalid value.
