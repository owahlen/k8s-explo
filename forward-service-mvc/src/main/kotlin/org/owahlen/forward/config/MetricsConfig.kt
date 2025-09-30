package org.owahlen.forward.config

import io.micrometer.common.KeyValue
import io.micrometer.common.KeyValues
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.server.observation.DefaultServerRequestObservationConvention
import org.springframework.http.server.observation.ServerRequestObservationContext

@Configuration
class MetricsConfig {

    @Bean
    fun pathTagConvention(): DefaultServerRequestObservationConvention =
        object : DefaultServerRequestObservationConvention() {
            override fun getLowCardinalityKeyValues(context: ServerRequestObservationContext): KeyValues {
                val base = super.getLowCardinalityKeyValues(context)
                val path = context.carrier.requestURI ?: "UNKNOWN"
                // WARNING: The path is a high-cardinality tag. Consider using a template
                // or a different tag for production environments.
                return base.and(KeyValue.of("path", path))
            }
        }
}
