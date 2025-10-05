import request from "supertest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { viteNodeApp } from "@/index.ts";

describe("Echo Service API", () => {
    const testPodName = "test-pod";

    beforeEach(() => {
        process.env.POD_NAME = testPodName;
    });

    afterEach(() => {
        delete process.env.POD_NAME;
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
});
