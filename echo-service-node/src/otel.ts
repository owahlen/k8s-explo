import {NodeSDK} from '@opentelemetry/sdk-node';
import {Resource, resourceFromAttributes} from '@opentelemetry/resources';
import {InstrumentType, PeriodicExportingMetricReader} from "@opentelemetry/sdk-metrics";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-http";
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {Attributes, Context, isSpanContextValid, trace} from "@opentelemetry/api";

// Prevent double init in dev/HMR
declare global {
    // eslint-disable-next-line no-var
    var __otelSdkStarted: boolean | undefined;
    // eslint-disable-next-line no-var
    var __otelSdkInstance: NodeSDK | undefined;
    // eslint-disable-next-line no-var
    var __otelShutdownHandlersInstalled: boolean | undefined;
}

// Optional switch: set OTEL_ENABLED=false to disable autostart on import
const OTEL_ENABLED = process.env.OTEL_ENABLED !== "false";

export async function startOtel(): Promise<void> {
    if (globalThis.__otelSdkStarted) return;
    globalThis.__otelSdkStarted = true;

    const resource: Resource = resourceFromAttributes({
        "service.name": process.env.OTEL_SERVICE_NAME || "echo-service-node",
        "service.namespace": process.env.OTEL_SERVICE_NAMESPACE || "default",
    });

    const exportInterval = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || "60000", 10);
    const exportTimeout = parseInt(process.env.OTEL_METRIC_EXPORT_TIMEOUT || "30000", 10);

    const sdk = new NodeSDK({
        resource,
        instrumentations: [
            new ExpressInstrumentation(),
            new HttpInstrumentation(),
        ],
        metricReaders: [
            new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter(),
                exportIntervalMillis: exportInterval,
                exportTimeoutMillis: exportTimeout,
            }),
        ],
        views: [
            {
                instrumentName: 'http.server.request.duration',
                instrumentType: InstrumentType.HISTOGRAM,
                attributesProcessors: [{
                    process: (incoming: Attributes, context?: Context): Attributes => {
                        if (context) {
                            const span = trace.getSpan(context);
                            const spanContext = span?.spanContext();
                            if (spanContext && isSpanContextValid(spanContext)) {
                                const path = span.attributes["url.path"]
                                if (path) {
                                    incoming["path"] = path;
                                }
                            }
                        }
                        return incoming
                    }
                }],
            },
        ],
    });

    await sdk.start();
    globalThis.__otelSdkInstance = sdk;

    if (!globalThis.__otelShutdownHandlersInstalled) {
        globalThis.__otelShutdownHandlersInstalled = true;
        const shutdown = async () => {
            try {
                await sdk.shutdown();
            } catch {
                // swallow
            } finally {
                process.exit(0);
            }
        };
        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
}

if (OTEL_ENABLED) {
    await startOtel();
}
