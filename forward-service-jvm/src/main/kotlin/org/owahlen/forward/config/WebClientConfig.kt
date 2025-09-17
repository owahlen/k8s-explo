package org.owahlen.forward.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.util.unit.DataSize
import org.springframework.web.reactive.function.client.ExchangeStrategies
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient

@Configuration
class WebClientConfig(
    @param:Value("\${FORWARDER_MAX_INMEMORY:4MB}") private val maxInMemory: String,
    @param:Value("\${FORWARDER_KEEPALIVE:true}") private val keepAlive: Boolean
) {
    @Bean
    fun webClient(): WebClient {
        val maxBytes = org.springframework.util.unit.DataSize.parse(maxInMemory).toBytes().toInt()
        val strategies = ExchangeStrategies.builder()
            .codecs { it.defaultCodecs().maxInMemorySize(maxBytes) }
            .build()

        val httpClient = HttpClient.create()
            .keepAlive(keepAlive)

        return WebClient.builder()
            .exchangeStrategies(strategies)
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .build()
    }
}
