# CaseFlow

CaseFlow is a Next.js + Prisma app for building and executing node-based workflows.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create your local env file from the example:

```bash
cp .env.example .env
```

3. Run the app:

```bash
npm run dev
```

## GitHub Safety

Safe to commit:

- `src/`
- `prisma/schema.prisma`
- `prisma/migrations/`
- `.env.example`
- `package.json`
- `package-lock.json`

Do not commit:

- `.env`
- real API keys
- `prisma/dev.db`
- `.next/`
- `node_modules/`

The app supports entering an OpenAI API key in the top toolbar. That key is stored in browser `localStorage` and sent to the server only when executing a node.

This is useful for private personal use, but it is not a secure multi-user auth model. Anyone using the browser can inspect their own key.

## Deployment

This project is best deployed as one repository containing both frontend and backend code.

Recommended platforms:

- Vercel for the Next.js app
- Neon, Supabase, or Railway Postgres for the database

### Automatic CD

Yes. Once your GitHub repository is connected to Vercel, pushes to `main` can trigger automatic production deployments.

Typical flow:

1. `git push` to GitHub
2. GitHub Actions runs CI
3. Vercel detects the new commit
4. Vercel builds and deploys automatically

You do not need to buy a separate CI/CD service for this setup.

### Sharing With Friends

You do not need to buy a domain just to let friends try the app.

If you deploy on Vercel, it will give you a free URL like:

```txt
https://caseflow-your-project.vercel.app
```

You can send that URL directly to friends.

A custom domain is optional and only useful if you want a cleaner public address such as:

```txt
https://caseflow.app
```

### Recommended First Deployment Path

1. Deploy to Vercel using the free `*.vercel.app` domain
2. Share that URL with friends for testing
3. Buy a custom domain later only if you want branding or a permanent public URL

## Database Notes

This project is now configured for PostgreSQL-compatible databases such as Supabase.

Use two URLs:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
```

Recommended usage:

- `DATABASE_URL`: pooled runtime connection for Prisma Client and Vercel
- `DIRECT_URL`: direct connection for Prisma CLI commands

The Prisma datasource is configured in `prisma/schema.prisma` with:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

For a fresh empty Supabase database, the fastest first setup is:

```bash
npm run db:push
```

This pushes the current Prisma schema into the remote Postgres database.

Because the older checked-in migrations were created during SQLite development, do not use them as-is against a fresh Supabase database.

Update your local `.env` to use the same `DATABASE_URL` and `DIRECT_URL` values before running Prisma commands locally.

## Suggested Production Setup

1. Push this repo to GitHub
2. Connect the repo to Vercel
3. Create a cloud Postgres database
4. Set `DATABASE_URL` and `DIRECT_URL` in Vercel
5. Run `npm run db:push` once against the Supabase database
6. Optionally set `OPENAI_API_KEY` on the server for private admin use
7. Push to `main` and let Vercel auto-deploy

## Important Security Note

If your current OpenAI key has ever been committed, shared, or exposed outside your local machine, rotate it immediately before deploying or sharing the repo.
