package org.owahlen.forward.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.client.HttpClient
import reactor.netty.resources.ConnectionProvider
import java.time.Duration

@Configuration
class WebClientConfig(
    @param:Value("\${CLIENT_MAX_CONNECTIONS:8}") private val maxConnections: Int,
) {
    @Bean
    fun webClient(): WebClient {

        val provider = ConnectionProvider.builder("forwarder-pool")
            .maxConnections(maxConnections)                                      // max number of connections
            .pendingAcquireMaxCount(1000)
            .pendingAcquireTimeout(Duration.ofMillis(5000))
            .maxLifeTime(Duration.ofMillis(60000))           // maxLiveTime (forces rotation)
            .maxIdleTime(Duration.ofMillis(4000))            // keepAliveTimeout (idle close)
            .evictInBackground(Duration.ofSeconds(30))  // periodic cleanup
            .fifo()                                                 // get the LRU of multiple idle HTTP connections
            .build()

        val httpClient = HttpClient
            .create(provider)
            .metrics(true) { uri -> uri.substringBefore('?') }

        return WebClient.builder()
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .build()
    }
}
