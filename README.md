# CaseFlow

CaseFlow is a technical prototype for graph-based AI workflow authoring. It combines a visual workspace for node execution with a reusable instruction library, allowing users to compose, branch, merge, and package prompt logic as structured graph operations instead of linear chat.

## Live Demo

Production deployment:

- https://case-flow-ebon.vercel.app/

## Prototype Goals

- Explore node-and-edge authoring for LLM-assisted work
- Support reusable prompt logic through a separate instruction library
- Preserve branching behavior by executing against upstream incoming context rather than the entire graph
- Test a lightweight full-stack architecture suitable for rapid iteration

## Core Capabilities

### Work Canvas

- Create, move, edit, and delete nodes
- Connect nodes with edges that bind either an instruction or an inline prompt
- Execute a selected node to generate the next node through the OpenAI API
- Merge multiple nodes into a new synthesized node
- Combine a subgraph into a reusable custom instruction

### Instruction Library

- Maintain `QUICK` instructions as reusable prompt templates
- Generate `CUSTOM` instructions from selected work subgraphs
- Preview and edit custom instruction graphs in a mini canvas
- Rebind instruction edges without executing inside the library view

### Execution Model

- Execution is explicit and single-step
- Edges define structure and prompt/instruction bindings
- Upstream context is collected through incoming graph traversal
- Generated output is stored as editable node state

## System Design

### Frontend

- Next.js App Router
- React 19
- React Flow for graph editing
- Material UI for UI composition

### Backend

- Next.js route handlers for application APIs
- Prisma ORM
- OpenAI Responses API for node execution

### Data Layer

- PostgreSQL-compatible runtime configuration
- Supabase-hosted Postgres for deployed environments
- Prisma schema and project-local migration history

## Development Workflow

```bash
npm install
cp .env.example .env
npm run dev
```

Useful commands:

```bash
npm run db:push
npm run db:import-sqlite
npm run build
```

## Environment Configuration

The project uses two database URLs:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
```

- `DATABASE_URL` is used for runtime connections in deployed environments
- `DIRECT_URL` is used for Prisma CLI operations and local development

An optional `OPENAI_API_KEY` can be configured server-side. The prototype also supports entering an API key in the UI toolbar for private testing flows.

## Deployment

Recommended deployment stack:

- Vercel for the application
- Supabase for PostgreSQL
- GitHub Actions for CI

Current delivery model:

- Pushes to `main` trigger GitHub CI
- Vercel is configured for automatic deployment from GitHub
- Supabase provides the shared hosted database for remote use

## Current Limitations

This is an MVP / prototype and intentionally excludes:

- automatic whole-graph execution
- multi-input execution semantics
- conditional routing
- instruction versioning
- collaborative multi-user auth
- production-hardened secrets management for shared public usage

## Notes

- Local `.env` files and real API keys must not be committed
- Legacy SQLite data can be imported into Postgres with `npm run db:import-sqlite`
- The current repository includes prototype-era migration history and active schema iteration
