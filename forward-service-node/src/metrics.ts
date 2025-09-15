import {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
    metrics as otelApi,
    type Counter,
    type Histogram
} from "@opentelemetry/api";
import {
    MeterProvider,
    PeriodicExportingMetricReader
} from "@opentelemetry/sdk-metrics";
import {Resource, resourceFromAttributes} from "@opentelemetry/resources";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-http";

// Optional: SDK debug logs
if (process.env.OTEL_DIAG_LOG_LEVEL === "DEBUG") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

/**
 * Config via env (with sensible defaults)
 *  - OTEL_EXPORTER_OTLP_ENDPOINT: e.g. http://otel-collector.monitoring.svc:4318
 *  - OTEL_SERVICE_NAME: your service name
 *  - OTEL_SERVICE_NAMESPACE: logical namespace/group
 */
const OTLP_HTTP_BASE =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, "") ||
    "http://otel-collector.monitoring.svc:4318";

const METRICS_URL = `${OTLP_HTTP_BASE}/v1/metrics`;

let started = false;

// Reusable instruments (optional until initialized)
let reqCounter: Counter | undefined;
let latencyHist: Histogram | undefined;

export function startMetrics(): void {
    if (started) return;

    const exporter = new OTLPMetricExporter({
        url: METRICS_URL,
        // headers: { Authorization: "Bearer …" },
    });

    const resource: Resource =
        resourceFromAttributes({
            "service.name": process.env.OTEL_SERVICE_NAME || "echo-service",
            "service.namespace": process.env.OTEL_SERVICE_NAMESPACE || "default",
    });

    const reader = new PeriodicExportingMetricReader({
            exporter,
            exportIntervalMillis: Number(process.env.OTEL_METRICS_EXPORT_INTERVAL_MS) || 10_000,
    });

    const meterProvider: MeterProvider = new MeterProvider({resource, readers: [reader]});

    // Make this provider the global one (so otelApi.getMeter uses it)
    otelApi.setGlobalMeterProvider(meterProvider);

    const meter = otelApi.getMeter("echo-metrics");

    reqCounter = meter.createCounter("http_requests_total", {
        description: "Total HTTP requests",
    });

    latencyHist = meter.createHistogram("http_request_duration", {
        description: "Request latency",
        unit: "ms",
    });

    // Flush on shutdown
    const shutdown = async () => {
        try {
            await meterProvider.shutdown();
        } catch {
            // ignore
        }
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);

    started = true;
}

/**
 * Record a handled request.
 * @param path URL path label (consider normalizing to a route template)
 * @param durationMs latency in milliseconds
 */
export function recordRequest(path: string, durationMs: number): void {
    if (!started) startMetrics();
    if (!reqCounter || !latencyHist) return;

    const attrs = {path};
    reqCounter.add(1, attrs);
    latencyHist.record(durationMs, attrs);
}
