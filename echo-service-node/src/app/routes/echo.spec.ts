import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { viteNodeApp } from "@/index.ts";

describe("Echo Service API", () => {
    const testPodName = "test-pod";

    beforeEach(() => {
        process.env.POD_NAME = testPodName;
    });

    afterEach(() => {
        delete process.env.POD_NAME;
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("responds to GET with 200 JSON", async () => {
        const res = await request(viteNodeApp).get("/foo?x=1");

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body.method).toBe("GET");
        expect(res.body.url).toBe("/foo?x=1");
        expect(res.body.pod_name).toBe(testPodName);
    });

    it("responds to POST with echoed body", async () => {
        const payload = { hello: "hello world!" };
        const res = await request(viteNodeApp).post("/data").send(payload);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body.method).toBe("POST");
        expect(res.body.url).toBe("/data");
        expect(res.body.body).toEqual(payload);
        expect(res.body.pod_name).toBe(testPodName);
    });

    it("defaults pod_name to null when env var missing", async () => {
        delete process.env.POD_NAME;
        const res = await request(viteNodeApp).get("/no-pod");

        expect(res.status).toBe(200);
        expect(res.body.pod_name).toBeNull();
    });

    it("delays the response by the latency query parameter", async () => {
        const latencyMs = 120;
        const start = Date.now();
        const requestPromise = request(viteNodeApp).get(`/delayed?latency=${latencyMs}`);
        const res = await requestPromise;
        const duration = Date.now() - start;

        expect(res.status).toBe(200);
        expect(res.body.url).toBe(`/delayed?latency=${latencyMs}`);
        expect(duration).toBeGreaterThanOrEqual(Math.max(0, latencyMs - 5));
    });

    it("uses a random latency up to latency_max when latency is missing", async () => {
        const latencyMax = 200;
        const expectedLatency = latencyMax / 2;
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const start = Date.now();
        const res = await request(viteNodeApp).get(`/random?latency_max=${latencyMax}`);
        const duration = Date.now() - start;

        expect(res.status).toBe(200);
        expect(res.body.url).toBe(`/random?latency_max=${latencyMax}`);
        expect(duration).toBeGreaterThanOrEqual(Math.max(0, expectedLatency - 5));
    });

    it("uses latency_min as lower bound when provided with latency_max", async () => {
        const latencyMin = 50;
        const latencyMax = 150;
        const expectedLatency = latencyMin + 0.2 * (latencyMax - latencyMin);
        vi.spyOn(Math, "random").mockReturnValue(0.2);

        const start = Date.now();
        const res = await request(viteNodeApp).get(`/random-range?latency_min=${latencyMin}&latency_max=${latencyMax}`);
        const duration = Date.now() - start;

        expect(res.status).toBe(200);
        expect(res.body.url).toBe(`/random-range?latency_min=${latencyMin}&latency_max=${latencyMax}`);
        expect(duration).toBeGreaterThanOrEqual(Math.max(0, expectedLatency - 5));
    });

    it("responds immediately when neither latency nor latency_max is set", async () => {
        const start = Date.now();
        const res = await request(viteNodeApp).get("/no-latency-params");
        const duration = Date.now() - start;

        expect(res.status).toBe(200);
        expect(res.body.url).toBe("/no-latency-params");
        expect(duration).toBeLessThan(50);
    });
});
