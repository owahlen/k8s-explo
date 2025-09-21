import "dotenv/config";
import "./otel.ts"; // patch/instrument: import first!
import http from "node:http";
import { buildApp } from "@/app/index.ts";
import { env } from "@/config/env.ts";
import logger from "@/infra/logger.ts";
import { closeAgent } from "@/http/agent.ts";
import {stopOtel} from "@/otel.ts";

const app = buildApp();
const server = http.createServer(app);

server.listen(env.port, () => {
    logger.info(`Forward listening on http://localhost:${env.port} (upstream: ${env.forwardBaseURL})`);
});

async function shutdown() {
    logger.info("Shutting down...");
    server.close(() => logger.info("HTTP server closed"));
    await closeAgent();
    await stopOtel();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Export the Express app directly for Vite to use.
export const viteNodeApp = app;
