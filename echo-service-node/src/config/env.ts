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
    port: fromEnv("PORT", 3000),
    maxRequestsPerSocket: fromEnv("MAX_REQUESTS_PER_SOCKET", 3000),
    otel: {
        enabled: fromEnv("OTEL_ENABLED", true),
        metricExportInterval: fromEnv("OTEL_METRIC_EXPORT_INTERVAL", 60000),
        metricExportTimeout: fromEnv("OTEL_METRIC_EXPORT_TIMEOUT", 30000),
    }
};
