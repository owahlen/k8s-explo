package org.owahlen.forward.config

import io.micrometer.common.KeyValue
import io.micrometer.common.KeyValues
import io.micrometer.core.instrument.config.MeterFilter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.server.reactive.observation.DefaultServerRequestObservationConvention
import org.springframework.http.server.reactive.observation.ServerRequestObservationContext

@Configuration
class MetricsConfig {

    @Bean
    fun dropActuatorFromHttpTimers(): MeterFilter =
        MeterFilter.deny { id ->
            id.name == "http:server.requests" &&
                    (id.getTag("uri")?.startsWith("/actuator/") == true)
        }

    @Bean
    fun pathTagConvention(): DefaultServerRequestObservationConvention {
        return object : DefaultServerRequestObservationConvention() {
            override fun getLowCardinalityKeyValues(context: ServerRequestObservationContext): KeyValues {
                val defaultKeyValues = super.getLowCardinalityKeyValues(context)
                val path = context.carrier.uri.path
                // WARNING: The path is a high-cardinality tag. Consider using a template
                // or a different tag for production environments.
                val customPathTag = KeyValue.of("path", path)
                return defaultKeyValues.and(customPathTag)
            }
        }
    }
}