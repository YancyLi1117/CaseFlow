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

Local development currently uses SQLite:

```env
DATABASE_URL="file:./dev.db"
```

For production, prefer cloud Postgres:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
```

If you move to Postgres, update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run:

```bash
npx prisma migrate deploy
```

## Suggested Production Setup

1. Push this repo to GitHub
2. Connect the repo to Vercel
3. Create a cloud Postgres database
4. Set `DATABASE_URL` in the deployment platform
5. Optionally set `OPENAI_API_KEY` on the server for private admin use
6. Run Prisma migrations during deployment

## Important Security Note

If your current OpenAI key has ever been committed, shared, or exposed outside your local machine, rotate it immediately before deploying or sharing the repo.
