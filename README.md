# Drive Hub (WheelsnationKe)

Drive Hub is a full-stack marketplace platform for vehicle listings, rentals, services, events, blog posts, and store products.

## Tech Stack

- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT + bcrypt
- Payments: M-Pesa + bank transfer metadata

## Project Structure

- `src/` - frontend app
- `server/src/` - backend API
- `server/db/schema.sql` - PostgreSQL schema

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+ (tested with 16)

## 1. Clone and install dependencies

From repo root:

```bash
npm install
```

From backend folder:

```bash
cd server
npm install
```

## 2. Database setup (local)

### Start PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
pg_lsclusters
```

### Set `postgres` password and create database

```bash
sudo -u postgres psql
```

Run in psql:

```sql
ALTER USER postgres WITH PASSWORD 'postgres';
CREATE DATABASE wheelsnationke;
\q
```

### Apply schema

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:5432/wheelsnationke' -f server/db/schema.sql
```

## 3. Backend environment

Create `server/.env`:

```env
PORT=8080
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/wheelsnationke
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
PGSSL=false
PGSSL_REJECT_UNAUTHORIZED=true

MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
MPESA_PARTYB=174379
MPESA_ACCOUNT_REFERENCE=DriveHub Order
MPESA_TRANSACTION_DESC=DriveHub checkout

BANK_NAME=Your Bank
BANK_ACCOUNT_NAME=WheelsnationKe Limited
BANK_ACCOUNT_NUMBER=1234567890
BANK_BRANCH=Main Branch
BANK_SWIFT=ABCDEXYZ
BANK_INSTRUCTIONS=Use the listing title as reference and share the transfer receipt.

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@wheelsnationke.local
INQUIRY_NOTIFY_EMAIL=alerts@wheelsnationke.local
```

Generate a secure JWT secret:

```bash
openssl rand -base64 48
```

## 4. Frontend environment

Create root `.env`:

```env
VITE_API_BASE_URL="http://localhost:8080"
```

## 5. Run the app

Backend (terminal 1):

```bash
cd server
npm run dev
```

Frontend (terminal 2, repo root):

```bash
npm run dev
```

## 6. Verify health

```bash
curl http://localhost:8080/api/health
```

Expected:

```json
{"ok":true,"db":"ok","time":"..."}
```

## 7. Create default admin user (local)

```bash
cd server
npm run seed:admin
```

Default login:

- Email: `admin@wheelsnationke.co.ke`
- Password: `123456`

Change password immediately in real deployments.

## Quality checks

From repo root:

```bash
npm run lint
npm test
npm run build
```

## Production notes

- Use `server/.env.production.example` as a template for production secrets.
- Set `NODE_ENV=production`.
- Set a real `CORS_ORIGIN` domain list.
- Use managed Postgres + SSL (`PGSSL=true`) in production.
- Leave `PGSSL_REJECT_UNAUTHORIZED=true` unless you have a very specific provider exception.
- If your DB provider gives you a custom CA certificate, set `PGSSL_CA` or `PGSSL_CA_FILE`.
- Never commit real credentials.

## Docker and CI

Build and run the app locally with Docker:

```bash
docker compose up --build
```

The frontend will be available on `http://localhost:4173` and the API on `http://localhost:8080`.

The repository also includes `.github/workflows/ci.yml` to run:

- frontend lint, tests, and build
- backend Node syntax checks

## Common errors and fixes

### `ECONNREFUSED 127.0.0.1:5432`

Postgres is not running.

```bash
sudo systemctl start postgresql
pg_lsclusters
```

### `password authentication failed`

DB credentials in `DATABASE_URL` are wrong.

Reset password:

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

### `getaddrinfo EAI_AGAIN HOST`

`DATABASE_URL` still contains placeholder host (`HOST`). Replace with `127.0.0.1` or real DB host.

### Bash error: `event not found` with password

If password contains `!`, either URL-encode it (`%21`) or use single quotes around connection string.

## License

Internal project / private use unless your team specifies otherwise.
