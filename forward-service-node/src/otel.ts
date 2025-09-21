import {NodeSDK} from '@opentelemetry/sdk-node';
import {Resource, resourceFromAttributes} from '@opentelemetry/resources';
import {InstrumentType, PeriodicExportingMetricReader} from "@opentelemetry/sdk-metrics";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-http";
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {ExpressInstrumentation} from '@opentelemetry/instrumentation-express';
import {Attributes, Context, isSpanContextValid, trace} from "@opentelemetry/api";
import {env} from "@/config/env.ts"; // central config

// Prevent double init in dev/HMR
declare global {
    // eslint-disable-next-line no-var
    var __otelSdkStarted: boolean | undefined;
    // eslint-disable-next-line no-var
    var __otelSdkInstance: NodeSDK | undefined;
}

export async function startOtel(): Promise<void> {
    if (globalThis.__otelSdkStarted) return;
    globalThis.__otelSdkStarted = true;

    const resource: Resource = resourceFromAttributes({
        "service.name": process.env.OTEL_SERVICE_NAME || "echo-service-node",
        "service.namespace": process.env.OTEL_SERVICE_NAMESPACE || "default",
    });

    const exportInterval = env.otel.metricExportInterval;
    const exportTimeout = env.otel.metricExportTimeout;

    const sdk = new NodeSDK({
        resource,
        instrumentations: [
            new ExpressInstrumentation(),
            new HttpInstrumentation(),
        ],
        metricReaders: [
            new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter(), // Reads OTEL_EXPORTER_OTLP_* envs
                exportIntervalMillis: exportInterval,
                exportTimeoutMillis: exportTimeout,
            }),
        ],
        views: [
            {
                instrumentName: "http.server.request.duration",
                instrumentType: InstrumentType.HISTOGRAM,
                attributesProcessors: [{
                    process: (incoming: Attributes, context?: Context): Attributes => {
                        if (context) {
                            const span = trace.getSpan(context);
                            const spanContext = span?.spanContext();
                            if (spanContext && isSpanContextValid(spanContext)) {
                                const path = span.attributes["url.path"];
                                if (path) {
                                    incoming["path"] = path;
                                }
                            }
                        }
                        return incoming;
                    }
                }],
            },
        ],
    });

    await sdk.start();
    globalThis.__otelSdkInstance = sdk;
}

export async function stopOtel(): Promise<void> {
    const sdk = globalThis.__otelSdkInstance;
    if (!sdk) return;
    try {
        await sdk.shutdown(); // graceful: flush + shutdown
    } finally {
        globalThis.__otelSdkInstance = undefined;
        globalThis.__otelSdkStarted = false;
    }
}

// Auto-start on import (unless explicitly disabled)
if (env.otel.enabled) {
    await startOtel();
}
