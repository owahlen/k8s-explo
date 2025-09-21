import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Keep a pristine copy of process.env so we can restore it after tests
const ORIGINAL_ENV = { ...process.env };

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
        process.env = { ...ORIGINAL_ENV };
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
        const { env } = await loadEnvModule();
        expect(env.port).toBe(3000);
        expect(env.forwardBaseURL).toBe("http://localhost:3000");
        expect(env.requestTimeout).toBe(15_000);
        expect(env.agent.keepAliveTimeout).toBe(4_000);
        expect(env.agent.keepAliveTimeoutThreshold).toBe(1_000);
        expect(env.agent.maxRequestsPerClient).toBe(5_000);
        expect(env.agent.clientLifetime).toBe(60_000);
        expect(env.agent.pipelining).toBe(1);
        expect(env.otel.enabled).toBe(false);
        expect(env.otel.metricExportInterval).toBe(60_000);
        expect(env.otel.metricExportTimeout).toBe(30_000);
    });

    it("parses numbers from env", async () => {
        process.env.PORT = "8080";
        process.env.KEEPALIVE_TIMEOUT = "7000";
        process.env.KEEPALIVE_THRESHOLD = "1500";
        process.env.MAX_REQUESTS_PER_CLIENT = "12345";
        process.env.CLIENT_LIFETIME = "600000";
        process.env.PIPELINING = "3";
        process.env.REQUEST_TIMEOUT = "20000";
        const { env } = await loadEnvModule();

        expect(env.port).toBe(8080);
        expect(env.agent.keepAliveTimeout).toBe(7000);
        expect(env.agent.keepAliveTimeoutThreshold).toBe(1500);
        expect(env.agent.maxRequestsPerClient).toBe(12345);
        expect(env.agent.clientLifetime).toBe(600000);
        expect(env.agent.pipelining).toBe(3);
        expect(env.requestTimeout).toBe(20000);
    });

    it("parses booleans from env", async () => {
        process.env.OTEL_ENABLED = "true";
        let mod = await loadEnvModule();
        expect(mod.env.otel.enabled).toBe(true);

        process.env.OTEL_ENABLED = "false";
        mod = await loadEnvModule();
        expect(mod.env.otel.enabled).toBe(false);
    });

    it('treats the literal string "null" as null', async () => {
        process.env.CONNECTIONS = "null";
        const { env } = await loadEnvModule();
        expect(env.agent.connections).toBeNull();
    });

    it("falls back to default when numeric env is invalid (e.g., NaN)", async () => {
        process.env.KEEPALIVE_TIMEOUT = "not-a-number";
        const { env } = await loadEnvModule();
        expect(env.agent.keepAliveTimeout).toBe(4_000);
    });

  it("parses strings from env", async () => {
        process.env.FORWARD_BASE_URL = "http://example.internal:9999";
        const { env } = await loadEnvModule();
        expect(env.forwardBaseURL).toBe("http://example.internal:9999");
    });

  it("falls back to default when boolean string is invalid", async () => {
    process.env.OTEL_ENABLED = "yes"; // not "true"/"false"
    const { env } = await loadEnvModule();
    expect(env.otel.enabled).toBe(false); // default
  });
});
