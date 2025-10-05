import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };
const KEEP: string[] = [];

async function loadEnvModule() {
    vi.resetModules();
    const { env } = await import('./env.ts');
    return env;
}

describe('env config (fromEnv)', () => {
    beforeAll(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    beforeEach(() => {
        for (const key of Object.keys(process.env)) {
            if (KEEP.includes(key)) continue;
            delete process.env[key];
        }
    });

    it('uses expected defaults when env is unset', async () => {
        const env = await loadEnvModule();
        expect(env.port).toBe(3000);
        expect(env.maxRequestsPerSocket).toBe(3000);
        expect(env.forwardBaseURL).toBe('http://localhost:3000');
        expect(env.requestTimeout).toBe(15_000);
        expect(env.podName).toBe('forward-service-node');
        expect(env.agent.connections).toBe(null);
        expect(env.agent.clientTtl).toBe(null);
        expect(env.agent.keepAliveTimeout).toBe(4_000);
        expect(env.agent.keepAliveTimeoutThreshold).toBe(1_000);
        expect(env.agent.pipelining).toBe(1);
        expect(env.agent.maxRequestsPerClient).toBe(5_000);
        expect(env.agent.allowH2).toBe(false);
        expect(env.otel.enabled).toBe(true);
        expect(env.otel.metricExportInterval).toBe(60_000);
        expect(env.otel.metricExportTimeout).toBe(30_000);
        expect(env.database.connectionString).toBe('postgres://app:postgres@localhost:5432/forwarddb');
        expect(env.database.ssl).toBe(false);
        expect(env.database.max).toBe(10);
        expect(env.database.idleTimeoutMillis).toBe(30_000);
        expect(env.database.connectionTimeoutMillis).toBe(5_000);
    });

    it('parses numbers from env', async () => {
        process.env.PORT = '8080';
        process.env.MAX_REQUESTS_PER_SOCKET = '50';
        process.env.REQUEST_TIMEOUT = '20000';
        process.env.CONNECTIONS = '10';
        process.env.CLIENT_TTL = '4000';
        process.env.KEEP_ALIVE_TIMEOUT = '7000';
        process.env.KEEP_ALIVE_THRESHOLD = '1500';
        process.env.PIPELINING = '3';
        process.env.MAX_REQUESTS_PER_CLIENT = '12345';
        process.env.OTEL_METRIC_EXPORT_INTERVAL = '30000';
        process.env.OTEL_METRIC_EXPORT_TIMEOUT = '15000';
        process.env.POSTGRES_POOL_MAX = '20';
        process.env.POSTGRES_POOL_IDLE_TIMEOUT = '45000';
        process.env.POSTGRES_POOL_CONNECTION_TIMEOUT = '6000';
        process.env.POSTGRES_URL = 'postgres://app:postgres@localhost:6543/forwarddb';

        const env = await loadEnvModule();

        expect(env.port).toBe(8080);
        expect(env.maxRequestsPerSocket).toBe(50);
        expect(env.requestTimeout).toBe(20000);
        expect(env.agent.connections).toBe(10);
        expect(env.agent.clientTtl).toBe(4000);
        expect(env.agent.keepAliveTimeout).toBe(7000);
        expect(env.agent.keepAliveTimeoutThreshold).toBe(1500);
        expect(env.agent.pipelining).toBe(3);
        expect(env.agent.maxRequestsPerClient).toBe(12345);
        expect(env.otel.metricExportInterval).toBe(30000);
        expect(env.otel.metricExportTimeout).toBe(15000);
        expect(env.database.max).toBe(20);
        expect(env.database.idleTimeoutMillis).toBe(45000);
        expect(env.database.connectionTimeoutMillis).toBe(6000);
        expect(env.database.connectionString).toBe('postgres://app:postgres@localhost:6543/forwarddb');
    });

    it('parses booleans from env', async () => {
        process.env.OTEL_ENABLED = 'true';
        process.env.ALLOW_H2 = 'false';
        process.env.POSTGRES_SSL = 'true';

        const env = await loadEnvModule();
        expect(env.otel.enabled).toBe(true);
        expect(env.agent.allowH2).toBe(false);
        expect(env.database.ssl).toBe(true);

        process.env.OTEL_ENABLED = 'false';
        process.env.ALLOW_H2 = 'true';
        process.env.POSTGRES_SSL = 'false';

        const envDisabled = await loadEnvModule();
        expect(envDisabled.otel.enabled).toBe(false);
        expect(envDisabled.agent.allowH2).toBe(true);
        expect(envDisabled.database.ssl).toBe(false);
    });

    it('treats the literal string "null" as null', async () => {
        process.env.CONNECTIONS = 'null';
        process.env.CLIENT_TTL = 'null';
        const env = await loadEnvModule();
        expect(env.agent.connections).toBeNull();
        expect(env.agent.clientTtl).toBeNull();
    });

    it('falls back to defaults when numeric env is invalid', async () => {
        process.env.KEEP_ALIVE_TIMEOUT = 'not-a-number';
        process.env.DB_POOL_MAX = 'nope';
        const env = await loadEnvModule();
        expect(env.agent.keepAliveTimeout).toBe(4_000);
        expect(env.database.max).toBe(10);
    });

    it('parses custom URLs and credentials', async () => {
        process.env.FORWARD_BASE_URL = 'http://example.internal:9999';
        process.env.POSTGRES_URL = 'postgres://custom:secret@db.internal:6000/customdb';

        const env = await loadEnvModule();
        expect(env.forwardBaseURL).toBe('http://example.internal:9999');
        expect(env.database.connectionString).toBe('postgres://custom:secret@db.internal:6000/customdb');
    });

    it('falls back to default when boolean string is invalid', async () => {
        process.env.OTEL_ENABLED = 'yes';
        const env = await loadEnvModule();
        expect(env.otel.enabled).toBe(true);
    });
});
