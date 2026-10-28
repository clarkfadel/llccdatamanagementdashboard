# LLCC Data Management Dashboard

Web dashboard for the LLCC PostgreSQL database so the office staff can view,
search and fix records without using SQL or pgAdmin.

There are two apps:

- `backend/` - Express + `pg` (raw queries). Runs on port **4100**.
- `frontend/` - React (Vite). Runs on port **5180** and proxies `/api` to the backend.

## How to run

Open two terminals.

```bash
# terminal 1
cd backend
npm install
cp .env.example .env   # then put your db credentials
npm run dev

# terminal 2
cd frontend
npm install
npm run dev            # http://localhost:5180
```

## Sample database (fake data)

The real database is behind Cloudflare and only the pgAdmin web UI is open
(port 5432 can't be reached from outside), so for local testing I use a local
`llcc_dev` database with fake data only.

```bash
cd backend
npm run seed     # creates the roles + llcc_dev on local Postgres and loads fake data
```

`db/seed_fake.js` makes the fake rows, loads them, and also rewrites the files
in `sample_csv/`. The fake data has the same problems as the real database
(`-1` placeholder rows, unmapped foreign keys, NULLs, duplicate clients,
`True`/`False` saved as text) so all the features can be tested.

Table names follow `backend/db/schema.sql`.
Default login is `admin` / `llcc` (set in `backend/.env`).

## Connecting to the real database

The backend reads the tables and columns from the database when it starts, so
switching to the real database only needs a change in `.env`.

On the server that can reach Postgres on 5432 (the VPS, or through an SSH
tunnel), copy `.env.production.example` to `.env` and set:

```
DATABASE_URL=postgres://readonly_user:PASSWORD@DB_HOST:5432/llcc
PGSSL=true
```

Restart the backend. It prints which database it connected to, and
`GET /api/health` shows it too (`{"ok":true,"database":"…/llcc"}`), so you can
check it's the right one.

For local testing just use the `PG*` variables in `.env`.

## Features

- **Browse** - dashboard counts, tables with search, sort and pages, and a detail page with related records
- **Global search** - one search box for clients, lots and transactions
- **Edit** - edit fields, add new records, bulk update selected rows
- **Fix `-1` links** - worklist where you pick the right Client/Lot for unmapped records
- **Data quality** - counts of unmapped fields, missing contact info and duplicates
- **Merge duplicates** - moves the references to the correct record then deletes the duplicate
- **CSV export** - export any table (with the current search)
- **Audit log + undo** - every change is saved and can be undone
- **Login** - one shared account, uses a token

## API

Everything is under `/api`. All routes need a token except `/health` and `/login`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | check db connection |
| POST | `/login` | get a token |
| GET | `/dashboard`, `/entities` | dashboard counts, sidebar items |
| GET | `/records/:table` | list (`?page&pageSize&search&sort&dir`) |
| GET | `/records/:table/:id` | one record + related records |
| POST/PATCH | `/records/:table[/:id]` | add / update |
| POST | `/records/:table/:id/link` | fix one foreign key |
| POST | `/records/:table/bulk`, `/merge` | bulk update, merge |
| GET | `/records/:table/export` | download CSV |
| GET | `/search`, `/lookup/:table` | global search, link picker search |
| GET | `/quality`, `/quality/unmapped/:table`, `/duplicates/:table` | data quality |
| GET/POST | `/audit`, `/audit/:id/undo` | change history + undo |

## Notes on the data

- `-1` foreign keys are shown as **"Unmapped"** instead of the number.
- `NULL` values are shown as a dash, not "null".
- `Status` and other `True`/`False` text fields are shown as badges.
- `Remarks` are shown as is.
