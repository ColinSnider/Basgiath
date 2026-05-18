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
```

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

## Production

```bash
npm run build
npm run start
```

This repository is now organized for standard standalone local development without platform-specific auth tooling.
