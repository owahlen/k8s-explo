# Repository Guidelines

## Project Structure & Module Organization
- `echo-service/`: TypeScript Express service (ESM) with Vite for build/dev.
  - `src/`: app code (`index.ts`, `logger.ts`, tests).
  - `dist/`: compiled output from `npm run build`.
  - `Dockerfile`: multi-stage build (Node 22 Alpine).
- `forward-service/`: forwards requests to echo-service and returns its response (same stack).
    - `src/`: app code (`index.ts`, `logger.ts`, tests).
    - `dist/`: compiled output from `npm run build`.
    - `Dockerfile`: multi-stage build (Node 22 Alpine).
- `http/`: example requests (`echo.http`).
- `k8s-explo.yaml`: Deployments, Services, and Ingress for both services.

## Build, Test, and Development Commands
- Install deps: `cd echo-service && npm ci`; for forward: `cd forward-service && npm ci`.
- Dev: echo on `3000` (`npm run dev`); forward on `3001` with `ECHO_BASE_URL=http://localhost:3000`.
- Build: `npm run build` (outputs to `dist/`).
- Run built: `npm start` or `node dist/index.js`.
- Tests: `npm test` in each service dir.
- Docker: `docker build -t <repo>/echo-service:<tag> echo-service` and `docker build -t <repo>/forward-service:<tag> forward-service`.
- Kubernetes: `kubectl apply -f k8s-explo.yaml` (images must match tags used).

## Coding Style & Naming Conventions
- Language: TypeScript (strict), ESM modules.
- Indentation: 4 spaces; single quotes preferred.
- Files: lower-case with dashes or simple names (`index.ts`, `logger.ts`).
- Logging: use `logger` (Winston); control via `LOG_LEVEL` env.

## Testing Guidelines
- Framework: Vitest with Supertest; tests co-located as `*.test.ts`.
- Echo example: `request(viteNodeApp).get('/hello')`.
- Forward example: POST body should appear in upstream echo response.
- Run: `npm test` inside each service directory.

## Commit & Pull Request Guidelines
- Commits: present tense, concise; scope prefix encouraged (`echo-service:`, `forward-service:`). Conventional Commits welcome.
- PRs: describe changes, include test evidence (logs or `curl`), and call out image tags/manifest updates.

## Security & Configuration Tips
- Containers run as non-root.
- Env (echo): `PORT` (3000), `LOG_LEVEL` (`info`). Env (forward): `PORT` (3001), `ECHO_BASE_URL`.
- Probes/limits: defined in `k8s-explo.yaml`; keep aligned with app behavior.
- Example checks: echo `curl "http://localhost:3000/?client=test"`; forward POST to `http://localhost:3001/...`.
