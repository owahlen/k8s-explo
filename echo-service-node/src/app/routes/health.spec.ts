import request from "supertest";
import { describe, it, expect } from "vitest";
import { viteNodeApp } from "@/index.ts";

describe("Health Endpoint", () => {
    it("responds with status ok and runtime info", async () => {
        const res = await request(viteNodeApp).get("/health");

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body).toHaveProperty("status", "ok");
        expect(res.body).toHaveProperty("uptime");
        expect(res.body).toHaveProperty("timestamp");
        expect(res.body).toHaveProperty("memoryUsage");
    });
});
