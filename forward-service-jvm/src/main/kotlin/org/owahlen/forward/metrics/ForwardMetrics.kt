package org.owahlen.forward.metrics

import io.micrometer.core.instrument.DistributionSummary
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component

@Component
class ForwardMetrics(
    private val registry: MeterRegistry
) {
    // Base meters; tagged variants are derived per path
    private val requestCounterName = "http_requests_total"
    private val durationSummaryName = "http_request_duration"

    init {
        // Pre-register base meters with descriptions/units for consistency
        DistributionSummary.builder(durationSummaryName)
            .baseUnit("milliseconds")
            .description("Request latency")
            // publish histogram so OTLP exporter emits histogram points
            .publishPercentileHistogram(true)
            .register(registry)

        registry.counter(requestCounterName).increment(0.0)
    }

    fun record(path: String, durationMs: Long) {
        // Counter: total requests with path label
        registry.counter(requestCounterName, "path", path).increment()

        // Histogram: record duration in milliseconds with path label
        registry.summary(durationSummaryName, "path", path)
            .record(durationMs.toDouble())
    }
}

