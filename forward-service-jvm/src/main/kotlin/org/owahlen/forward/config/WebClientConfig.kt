package org.owahlen.forward.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.ExchangeStrategies
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig(
    @param:Value("\${FORWARDER_MAX_INMEMORY:4MB}") private val maxInMemory: String
) {
    @Bean
    fun webClient(): WebClient {
        val maxBytes = org.springframework.util.unit.DataSize.parse(maxInMemory).toBytes().toInt()
        val strategies = ExchangeStrategies.builder()
            .codecs { it.defaultCodecs().maxInMemorySize(maxBytes) }
            .build()

        return WebClient.builder()
            .exchangeStrategies(strategies)
            // timeouts/connector can be set here (Reactor Netty)
            .build()
    }
}
