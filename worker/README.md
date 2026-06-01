# Meditpharma tracking Worker (Cloudflare + D1)

REST API that persists the tracking-sheet rows from the web app into a
Cloudflare D1 database. The static `index.html` works without it (it falls back
to browser `localStorage`); deploy this when you want saved rows shared/durable.

## One-time setup

```bash
cd worker
npm install

# Authenticate (or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars)
npx wrangler login

# Create the database and paste the printed database_id into wrangler.toml
npx wrangler d1 create pharmaconsulta_tracking

# Create the table
npx wrangler d1 migrations apply pharmaconsulta_tracking --remote

# Deploy — prints your https://pharmaconsulta-tracking.<subdomain>.workers.dev URL
npx wrangler deploy
```

Then open the app, paste that Worker URL into **Sync API URL** in the Tracking
section, and click **Save URL**. Saves/edits now go to D1.

## API token scopes

Account · Workers Scripts · Edit  •  Account · D1 · Edit  •
Account · Account Settings · Read

## Endpoints

| Method | Path            | Purpose            |
|--------|-----------------|--------------------|
| GET    | `/api/rows`     | list all rows      |
| POST   | `/api/rows`     | insert a row       |
| PUT    | `/api/rows/:id` | overwrite a row    |
| DELETE | `/api/rows/:id` | delete a row       |

Request/response bodies use camelCase keys matching the app
(`day`, `date`, `isoDate`, `orderNumber`, `trackingNumber`, `product`,
`quantity`, `productDescription`, `destCity`, `destState`, `account`, `client`,
`deliveredOn`, `deliveredOnIso`, `comments`, `directionRemarks`).
