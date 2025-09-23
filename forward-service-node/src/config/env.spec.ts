import {beforeAll, afterAll, beforeEach, describe, expect, it, vi} from "vitest";

// Keep a pristine copy of process.env so we can restore it after tests
const ORIGINAL_ENV = {...process.env};

// If there are vars you want to preserve across tests, list them here:
const KEEP: string[] = [
    // "NODE_ENV",
];

async function loadEnvModule() {
    // Force re-import so the `env` constant is recomputed with current process.env
    vi.resetModules();
    return await import("./env.ts"); // e.g., "../src/config/env"
}

describe("env config (fromEnv)", () => {
    beforeAll(() => {
        // Ensure tests are not influenced by shell env
        process.env = {...ORIGINAL_ENV};
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    beforeEach(() => {
        // Clean slate every test
        for (const k of Object.keys(process.env)) {
            if (KEEP.includes(k)) continue;
            delete process.env[k];
        }
    });

    it("uses default numbers/strings/bools when env is unset", async () => {
        const {env} = await loadEnvModule();
        expect(env.port).toBe(3000);
        expect(env.forwardBaseURL).toBe("http://localhost:3000");
        expect(env.requestTimeout).toBe(15_000);
        expect(env.agent.connections).toBe(null);
        expect(env.agent?.clientTtl).toBe(null);
        expect(env.agent.keepAliveTimeout).toBe(4_000);
        expect(env.agent.keepAliveTimeoutThreshold).toBe(1_000);
        expect(env.agent.pipelining).toBe(1);
        expect(env.agent.maxRequestsPerClient).toBe(5_000);
        expect(env.agent.allowH2).toBe(false);
        expect(env.otel.enabled).toBe(true);
        expect(env.otel.metricExportInterval).toBe(60_000);
        expect(env.otel.metricExportTimeout).toBe(30_000);
    });

    it("parses numbers from env", async () => {
        process.env.PORT = "8080";
        process.env.REQUEST_TIMEOUT = "20000";
        process.env.CONNECTIONS = "10";
        process.env.CLIENT_TTL = "4000";
        process.env.KEEP_ALIVE_TIMEOUT = "7000";
        process.env.KEEP_ALIVE_THRESHOLD = "1500";
        process.env.PIPELINING = "3";
        process.env.MAX_REQUESTS_PER_CLIENT = "12345";
        process.env.OTEL_METRIC_EXPORT_INTERVAL = "30000";
        process.env.OTEL_METRIC_EXPORT_TIMEOUT = "15000";
        const {env} = await loadEnvModule();

        expect(env.port).toBe(8080);
        expect(env.requestTimeout).toBe(20000);
        expect(env.agent.connections).toBeNull(); // connections has a null default, so it doesn't get parsed as a number
        expect(env.agent.clientTtl).toBeNull(); // clientTtl has a null default, so it doesn't get parsed as a number
        expect(env.agent.keepAliveTimeout).toBe(7000);
        expect(env.agent.keepAliveTimeoutThreshold).toBe(1500);
        expect(env.agent.pipelining).toBe(3);
        expect(env.agent.maxRequestsPerClient).toBe(12345);
        expect(env.otel.metricExportInterval).toBe(30000);
        expect(env.otel.metricExportTimeout).toBe(15000);
    });

    it("parses booleans from env", async () => {
        // Test OTEL_ENABLED
        process.env.OTEL_ENABLED = "true";
        process.env.ALLOW_H2 = "false";
        let mod = await loadEnvModule();
        expect(mod.env.otel.enabled).toBe(true);
        expect(mod.env.agent.allowH2).toBe(false);

        // Test with opposite values
        process.env.OTEL_ENABLED = "false";
        process.env.ALLOW_H2 = "true";
        mod = await loadEnvModule();
        expect(mod.env.otel.enabled).toBe(false);
        expect(mod.env.agent.allowH2).toBe(true);
    });

    it('treats the literal string "null" as null', async () => {
        process.env.CONNECTIONS = "null";
        const {env} = await loadEnvModule();
        expect(env.agent.connections).toBeNull();
    });

    it("falls back to default when numeric env is invalid (e.g., NaN)", async () => {
        process.env.KEEP_ALIVE_TIMEOUT = "not-a-number";
        const {env} = await loadEnvModule();
        expect(env.agent.keepAliveTimeout).toBe(4_000);
    });

    it("parses strings from env", async () => {
        process.env.FORWARD_BASE_URL = "http://example.internal:9999";
        const {env} = await loadEnvModule();
        expect(env.forwardBaseURL).toBe("http://example.internal:9999");
    });

    it("falls back to default when boolean string is invalid", async () => {
        process.env.OTEL_ENABLED = "yes"; // not "true"/"false"
        const {env} = await loadEnvModule();
        expect(env.otel.enabled).toBe(true); // default
    });
});
