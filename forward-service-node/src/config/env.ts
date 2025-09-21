const fromEnv = <T extends string | number | boolean | null>(name: string, def: T): T => {
    const val = process.env[name];
    if (val === "null") {
        return null as T;
    }
    if (val !== undefined) {
        // Handle boolean strings
        if (typeof def === "boolean") {
            if (val.toLowerCase() === "true") {
                return true as T;
            }
            if (val.toLowerCase() === "false") {
                return false as T;
            }
        }

        // Handle number strings
        if (typeof def === "number") {
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) {
                return parsed as T;
            }
        }

        // Handle strings
        if (typeof def === "string") {
            return val as T;
        }

    }
    // Return the default value if the env var is not found or has a wrong type
    return def as T;
}

export const env = {
    port: fromEnv("PORT", 3001),
    forwardBaseURL: fromEnv("FORWARD_BASE_URL", "http://localhost:3000"),
    requestTimeout: fromEnv("REQUEST_TIMEOUT", 15_000),
    agent: {
        connections: fromEnv("CONNECTIONS", null),
        keepAliveTimeout: fromEnv("KEEPALIVE_TIMEOUT", 4_000),
        keepAliveTimeoutThreshold: fromEnv("KEEPALIVE_THRESHOLD", 1_000),
        maxRequestsPerClient: fromEnv("MAX_REQUESTS_PER_CLIENT", 5_000),
        clientLifetime: fromEnv("CLIENT_LIFETIME", 60_000),
        pipelining: fromEnv("PIPELINING", 1),
    },
    otel: {
        enabled: fromEnv("OTEL_ENABLED", false),
        metricExportInterval: fromEnv("OTEL_METRIC_EXPORT_INTERVAL", 60000),
        metricExportTimeout: fromEnv("OTEL_METRIC_EXPORT_TIMEOUT", 30000),
    }
};
