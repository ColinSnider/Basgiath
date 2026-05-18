# Basgiath

Basgiath is a reading companion built for readers who want a quiet, focused place to track books, capture notes, and measure progress over time.

The app combines a polished reading dashboard with personal library management, margin notes, reading goals, and account settings in a single TypeScript-based web application.

## Features

- Track books across reading, finished, and wishlist states
- Record reading progress for both books and audiobooks
- View a dashboard with yearly totals, active reads, recent notes, and recently finished books
- Save margin entries as quotes or notes, with optional page references
- Set weekly, monthly, or yearly reading goals
- Review your full reading history in the library view
- Manage account details such as display name, email, and password
- Customize appearance with dark mode, accent colors, text size, and compact mode
- Authenticate with either username/password or Replit login

## Tech stack

### Frontend

- React 19
- TypeScript
- TanStack React Router
- TanStack React Start
- TanStack React Query
- Tailwind CSS 4
- Radix UI primitives
- Lucide React

### Backend and data

- TanStack Start server functions
- Drizzle ORM
- PostgreSQL
- Zod for validation
- bcryptjs for password hashing
- OpenID Connect support for Replit authentication

### Tooling and platform

- Vite
- ESLint
- Prettier
- Drizzle Kit
- Wrangler
- Bun lockfile included, with npm lockfile also present

## Application overview

Basgiath is structured as a full-stack TypeScript application with shared models and schema definitions.

### Core routes

- `/` — landing page for signed-out users and dashboard for signed-in users
- `/login` — login and registration flow, including Replit auth
- `/library` — personal library and reading history
- `/book/$id` — individual book detail and progress view
- `/margins` — quotes, notes, and reflections
- `/goals` — reading goal management
- `/profile` — user profile
- `/settings` — account, appearance, and reading preferences
- `/callback` — authentication callback handling

### Data model

The app stores data for:

- users
- sessions
- books
- margins
- goals
- user settings

Shared schema definitions live in `shared/schema.ts`, and the database connection is configured in `server/db.ts`.

## Project structure

```text
.
├── server/             # Database and server-side integrations
├── shared/             # Shared schema and model definitions
├── src/
│   ├── routes/         # App routes and page-level UI
│   ├── lib/            # Client and server utility logic
│   ├── components/     # Reusable UI components
│   └── styles.css      # Global styling and theme tokens
├── drizzle.config.ts   # Drizzle configuration
├── wrangler.jsonc      # Wrangler configuration
├── vite.config.ts      # Vite configuration
└── package.json        # Scripts and dependencies
```

## Getting started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- PostgreSQL

Depending on your preferred workflow, Bun may also be useful because the repository includes a `bun.lock` file.

## Installation

```bash
git clone https://github.com/ColinSnider/Basgiath.git
cd Basgiath
npm install
```

## Environment variables

At minimum, the app expects a PostgreSQL connection string:

```bash
DATABASE_URL=your_postgres_connection_string
```

Because the app includes Replit OpenID Connect authentication support, additional auth-related environment variables may also be required depending on how that flow is configured in your deployment environment.

If you are deploying with Cloudflare or integrating with Replit authentication, review the relevant config files and server auth modules before deployment.

## Development

Start the development server:

```bash
npm run dev
```

## Available scripts

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run start
npm run lint
npm run format
npm run db:push
```

### Script details

- `npm run dev` — start the Vite development server
- `npm run build` — create a production build
- `npm run build:dev` — create a development-mode build
- `npm run preview` — preview the built app locally
- `npm run start` — run the production server entry
- `npm run lint` — run ESLint
- `npm run format` — format the codebase with Prettier
- `npm run db:push` — push the Drizzle schema to the configured database

## Authentication

Basgiath supports two sign-in methods:

- local username/password authentication
- Replit-based authentication through an OpenID Connect flow

Session data is persisted in the database and used to load authenticated user data such as books, margins, goals, and settings.

## Customization

The application includes built-in user preferences for:

- dark mode
- accent color themes
- font scaling
- compact mode

These preferences are stored per user in the `user_settings` table.

## Deployment notes

The repository includes both server-side database access and a `wrangler.jsonc` configuration, which suggests the app is being prepared for a modern deployment workflow that may involve Cloudflare-compatible tooling.

Before deploying, verify:

- all required environment variables are set
- the PostgreSQL database is provisioned and reachable
- authentication callback URLs are configured correctly
- the database schema has been pushed with Drizzle

## Status

This repository appears to be an actively developing project with the core product experience already in place, including authentication, dashboard views, reading data management, notes, goals, and settings.

## License

No license is currently defined in this repository. If you plan to share or distribute the project, consider adding a license file.
