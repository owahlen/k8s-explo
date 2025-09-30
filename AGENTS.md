# Repository Guidelines

## Project Structure & Module Organization
- `echo-service-node/`: TypeScript Express service (ESM) with Vite for build/dev.
  - `src/`: app code (`index.ts`, `logger.ts`, tests).
  - `dist/`: compiled output from `npm run build`.
  - `Dockerfile`: multi-stage build (Node 22 Alpine).
- `forward-service-node/`: forwards requests to echo-service and returns its response (same stack).
  - `src/`: app code (`index.ts`, `logger.ts`, tests).
  - `dist/`: compiled output from `npm run build`.
  - `Dockerfile`: multi-stage build (Node 22 Alpine).
- `forward-service-webflux/`: forward requests to echo-service using Kotlin + Spring WebFlux.
- `forward-service-mvc/`: forward requests to echo-service using Kotlin + Spring MVC (blocking IO).
- `http/`: example requests (`echo.http`).
- `k8s-explo.yaml`: Deployments, Services, and Ingress for both services.

## Build, Test, and Development Commands
- Install deps (Node): `cd echo-service-node && npm ci`; `cd forward-service-node && npm ci`.
- Dev (Node): echo on `3000` (`npm run dev`); forward-node on `3001` with `FORWARD_BASE_URL=http://localhost:3000`.
- Build (Node): `npm run build` (outputs to `dist/`).
- Run built (Node): `npm start` or `node dist/index.js`.
- Tests (Node): `npm test` in each service dir.
- JVM forwarders (Kotlin):
  - WebFlux: `cd forward-service-webflux && ./gradlew bootRun` (set `FORWARD_BASE_URL`); tests via `./gradlew test`.
  - MVC: `cd forward-service-mvc && ./gradlew bootRun` (set `FORWARD_BASE_URL`); tests via `./gradlew test`.
- Docker (Node images): `docker build -t <repo>/echo-service:<tag> echo-service-node` and `docker build -t <repo>/forward-service:<tag> forward-service-node`.
- Kubernetes: `kubectl apply -f k8s-explo.yaml` (images must match tags used).

## Coding Style & Naming Conventions
- Node: TypeScript (strict), ESM modules; 4-space indent; single quotes; use `logger` (Winston).
- WebFlux: Kotlin, Spring Boot 3 + WebFlux, coroutines (`suspend` controllers), idiomatic null-safety.
- MVC: Kotlin, Spring Boot 3 + MVC, blocking IO.

## Testing Guidelines
- Node: Vitest with Supertest; tests co-located as `*.test.ts`.
- WebFlux: Spring Boot test + WebTestClient; integration tests under `forward-service-webflux/src/test/...`.
- MVC: Spring Boot test + TestRestTemplate; integration tests under `forward-service-mvc/src/test/...`.
- Echo example: `request(viteNodeApp).get('/hello')`.
- Forward example: POST body should appear in upstream echo response.
- Run: `npm test` (Node) or `./gradlew test` (WebFlux/MVC).

## Commit & Pull Request Guidelines
- Commits: present tense, concise; scope prefix encouraged (`echo-service-node:`, `forward-service-node:`, `forward-service-webflux:`, `forward-service-mvc:`). Conventional Commits welcome.
- PRs: describe changes, include test evidence (logs or `curl`), and call out image tags/manifest updates.

## Security & Configuration Tips
- Containers run as non-root.
- Env (echo-node): `PORT` (3000), `LOG_LEVEL` (`info`). Env (forwarders): `PORT` (3001 for node), `FORWARD_BASE_URL`.
- Probes/limits: defined in `k8s-explo.yaml` for Node services; keep aligned with app behavior.
- Example checks: echo `curl "http://localhost:3000/?client=test"`; forward POST to Node `http://localhost:3001/...` or WebFlux/MVC `http://localhost:8080/...` when running locally.
