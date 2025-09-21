import request from "supertest";
import { describe, it, expect } from "vitest";
import { viteNodeApp } from "@/index.ts";

describe("Echo Service API", () => {
    it("responds to GET with 200 JSON", async () => {
        const res = await request(viteNodeApp).get("/foo?x=1");

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body.method).toBe("GET");
        expect(res.body.url).toBe("/foo?x=1");
    });

    it("responds to POST with echoed body", async () => {
        const payload = { hello: "hello world!" };
        const res = await request(viteNodeApp).post("/data").send(payload);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body.method).toBe("POST");
        expect(res.body.url).toBe("/data");
        expect(res.body.body).toEqual(payload);
    });
});
