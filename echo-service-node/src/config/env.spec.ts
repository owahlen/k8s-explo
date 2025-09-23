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
        expect(env.otel.enabled).toBe(true);
        expect(env.otel.metricExportInterval).toBe(60_000);
        expect(env.otel.metricExportTimeout).toBe(30_000);
    });

    it("parses numbers from env", async () => {
        process.env.PORT = "8080";
        process.env.OTEL_METRIC_EXPORT_INTERVAL = "30000";
        process.env.OTEL_METRIC_EXPORT_TIMEOUT = "15000";
        const {env} = await loadEnvModule();

        expect(env.port).toBe(8080);
        expect(env.otel.metricExportInterval).toBe(30000);
        expect(env.otel.metricExportTimeout).toBe(15000);
    });

    it("parses booleans from env", async () => {
        process.env.OTEL_ENABLED = "true";
        let mod = await loadEnvModule();
        expect(mod.env.otel.enabled).toBe(true);

        process.env.OTEL_ENABLED = "false";
        mod = await loadEnvModule();
        expect(mod.env.otel.enabled).toBe(false);
    });

    it("falls back to default when boolean string is invalid", async () => {
        process.env.OTEL_ENABLED = "yes"; // not "true"/"false"
        const {env} = await loadEnvModule();
        expect(env.otel.enabled).toBe(true); // default
    });

    it("falls back to default when numeric env is invalid (e.g., NaN)", async () => {
        process.env.PORT = "not-a-number";
        const {env} = await loadEnvModule();
        expect(env.port).toBe(3000);
    });
});
