# Drive Hub (WheelsnationKe)

This repo contains:
- Frontend (Vite + React + TypeScript)
- Backend API (Node.js + Express)
- PostgreSQL schema

## Requirements
- Node.js 18+
- PostgreSQL 14+

## Frontend
From the repo root:

```sh
npm install
npm run dev
```

The frontend expects an API base URL in `.env`:

```
VITE_API_BASE_URL="http://localhost:8080"
```

Vite runs on `http://localhost:5173` by default.

## Backend
From `server`:

```sh
npm install
cp .env.example .env
npm run dev
```

## Database
Create a local database and apply the schema:

```sh
createdb wheelsnationke
psql postgresql://localhost:5432/wheelsnationke -f server/db/schema.sql
```

Then set `DATABASE_URL` and `JWT_SECRET` in `server/.env`.
