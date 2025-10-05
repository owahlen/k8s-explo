import Undici from 'undici';

export type AgentOptions = ConstructorParameters<typeof Undici.Agent>[0];

type Primitive = string | number | boolean | null;

const fromEnv = <T extends Primitive>(name: string, def: T): T => {
    const val = process.env[name];
    if (val === undefined) {
        return def;
    }

    if (val === 'null') {
        return null as T;
    }

    if (typeof def === 'boolean') {
        if (val.toLowerCase() === 'true') {
            return true as T;
        }
        if (val.toLowerCase() === 'false') {
            return false as T;
        }
        return def;
    }

    if (typeof def === 'number') {
        const parsed = Number.parseInt(val, 10);
        return Number.isNaN(parsed) ? def : (parsed as T);
    }

    return val as T;
};

const optionalNumberFromEnv = (name: string, def: number | null): number | null => {
    const val = process.env[name];
    if (val === undefined) {
        return def;
    }

    if (val === 'null') {
        return null;
    }

    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? def : parsed;
};

export const env = {
    port: fromEnv('PORT', 3000),
    maxRequestsPerSocket: fromEnv('MAX_REQUESTS_PER_SOCKET', 3000),
    forwardBaseURL: fromEnv('FORWARD_BASE_URL', 'http://localhost:3000'),
    requestTimeout: fromEnv('REQUEST_TIMEOUT', 15_000),
    podName: fromEnv('POD_NAME', 'forward-service-node'),
    agent: {
        connections: optionalNumberFromEnv('CONNECTIONS', null),
        clientTtl: optionalNumberFromEnv('CLIENT_TTL', null),
        keepAliveTimeout: fromEnv('KEEP_ALIVE_TIMEOUT', 4_000),
        keepAliveTimeoutThreshold: fromEnv('KEEP_ALIVE_THRESHOLD', 1_000),
        pipelining: fromEnv('PIPELINING', 1),
        maxRequestsPerClient: fromEnv('MAX_REQUESTS_PER_CLIENT', 5_000),
        allowH2: fromEnv('ALLOW_H2', false),
    } as AgentOptions,
    otel: {
        enabled: fromEnv('OTEL_ENABLED', true),
        metricExportInterval: fromEnv('OTEL_METRIC_EXPORT_INTERVAL', 60_000),
        metricExportTimeout: fromEnv('OTEL_METRIC_EXPORT_TIMEOUT', 30_000),
    },
    database: {
        connectionString: fromEnv('POSTGRES_URL', 'postgres://app:postgres@localhost:5432/forwarddb'),
        ssl: fromEnv('POSTGRES_SSL', false),
        max: fromEnv('POSTGRES_POOL_MAX', 10),
        idleTimeoutMillis: fromEnv('POSTGRES_POOL_IDLE_TIMEOUT', 30_000),
        connectionTimeoutMillis: fromEnv('POSTGRES_POOL_CONNECTION_TIMEOUT', 5_000),
    },
};
