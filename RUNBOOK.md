# USPIRE ERP — RUNBOOK

## Local Development

### Backend

1. Install dependencies

- `npm install`

2. Prisma

- Generate client: `npm run prisma:generate`
- Run migrations (dev): `npm run prisma:migrate`
- Seed (optional): `npm run prisma:seed`

3. Run

- Dev: `npm run start:dev`
- Build: `npm run build`
- Prod (local): `npm run start:prod`

4. Health / readiness

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/ready`

Notes:
- Most API routes require `x-tenant-id` and `Authorization` headers.
- `/health` and `/ready` do not require `x-tenant-id`.

### Frontend

1. Install dependencies

- `npm install`

2. Run

- Dev: `npm run dev`
- Build: `npm run build`
- Preview dist: `npm run preview`


## Production

### Environment

- Use `backend/uspire-erp-backend/.env.example` as a template.
- Use `frontend/.env.example` as a template.
- Do not commit real secrets.

### Backend deploy

1. Install

- `npm ci`

2. Build

- `npm run build`

3. Migrate (deploy)

- `npx prisma migrate deploy`

4. Start

- `npm run start:prod`

### Frontend deploy

1. Build

- `npm ci`
- `npm run build`

2. Serve

- Serve `dist/` via your static hosting (or reverse proxy).


## Troubleshooting

### Prisma on Windows: EPERM / file lock

If you see Windows `EPERM` errors related to Prisma binaries:

- Stop running Node processes using Prisma.
- Delete `node_modules/.prisma` if needed.
- Reinstall deps: `npm ci` (or `npm install`)
- Regenerate client: `npm run prisma:generate`

### Common port conflicts

If `3000` or `5173` is already in use:

- Change `PORT` for backend.
- For Vite, run `npm run dev -- --port 5174` or set your preferred port.

### Verify health / readiness

- `GET /health` should return `{ "status": "ok" }`.
- `GET /ready` should return `{ "status": "ok", "checks": { "db": "ok", "storage": "ok" } }` when dependencies are healthy.
- If DB connectivity fails at runtime, `/ready` will return `503` with `{ "status": "fail", "checks": { "db": "fail", ... } }`.
