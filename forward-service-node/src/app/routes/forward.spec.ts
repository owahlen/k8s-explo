import express from "express";
import request from "supertest";
import {Server} from "http";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

// Configure env BEFORE importing the app
process.env.OTEL_ENABLED = "false";

describe("Forward Service API", () => {
    let upstream: Server;
    let forward: Server;
    let upstreamPort: number;
    let app: import("express").Express;

    beforeAll(async () => {
        // Start a simple upstream echo server
        const upstreamApp = express();
        upstreamApp.use(express.json());
        upstreamApp.use((req, res) => {
            res.status(200).json({
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
                body: req.body || null,
                query: req.query || null,
            });
        });

        await new Promise<void>((resolve) => {
            upstream = upstreamApp.listen(0, () => {
                const addr = upstream.address();
                if (typeof addr === "object" && addr && addr.port) {
                    upstreamPort = addr.port;
                    resolve();
                } else {
                    throw new Error("Failed to determine upstream port");
                }
            });
        });

        // Point forwarder to the dynamic upstream
        process.env.FORWARD_BASE_URL = `http://127.0.0.1:${upstreamPort}`;

        // Import your app AFTER env is set
        // If you have buildApp(): const { buildApp } = await import("../src/app");
        // app = buildApp();
        const {viteNodeApp} = await import("@/index.ts"); // adjust path if needed
        app = viteNodeApp;

        // Create a real HTTP server for the forwarder (optional; supertest can use app directly)
        await new Promise<void>((resolve) => {
            forward = app.listen(0, () => resolve());
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => forward?.close(() => resolve()));
        await new Promise<void>((resolve) => upstream?.close(() => resolve()));

        // Close Undici Agent gracefully if you export closeAgent()
        const {closeAgent} = await import("@/http/agent.ts"); // adjust path if needed
        await closeAgent();

    });

    it("forwards GET and returns upstream JSON", async () => {
        const res = await request(app).get("/hello?client=test");
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body).toHaveProperty("method", "GET");
        expect(res.body).toHaveProperty("url", "/hello?client=test");
    });

    it("forwards POST body and mirrors upstream response", async () => {
        const payload = {message: "forward me"};
        const res = await request(app).post("/data").send(payload);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("method", "POST");
        expect(res.body).toHaveProperty("url", "/data");
        expect(res.body).toHaveProperty("body");
        expect(res.body.body).toEqual(payload);
    });

});
