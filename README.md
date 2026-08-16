# AUD Subjective Monitoring Platform

This repository is the implementation workspace for the V1 AUD subjective monitoring product. At this stage it contains foundation infrastructure only; it does not implement clinical workflows.

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- pnpm 10.24.0, as pinned by the root `packageManager` field

Install dependencies from the repository root:

```sh
pnpm install
```

## Local development

Start the web and backend development processes together:

```sh
pnpm dev
```

- Web: <http://localhost:5173>
- Backend: <http://localhost:3000>
- Temporary backend liveness endpoint: <http://localhost:3000/health/live>

The web development server proxies relative `/api` requests to the backend. Browser code should use relative paths such as `/api/v1/...`.

## Root commands

```sh
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Workspace layout

```text
apps/web             React and Vite web application
apps/backend         Fastify backend application
packages/contracts   Framework-independent shared Zod contracts
```
