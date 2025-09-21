package org.owahlen.forward.config

import io.netty.channel.ChannelOption
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.web.reactive.function.client.ExchangeStrategies
import org.springframework.web.reactive.function.client.WebClient
import reactor.netty.http.HttpProtocol
import reactor.netty.http.client.HttpClient
import reactor.netty.resources.ConnectionProvider
import java.time.Duration

@Configuration
class WebClientConfig(
    @param:Value("\${FORWARDER_MAX_INMEMORY:4MB}") private val maxInMemory: String,
    @param:Value("\${FORWARDER_KEEPALIVE:true}") private val keepAlive: Boolean,
    @param:Value("\${FORWARDER_CONNECTIONS:8}") private val connections: Int,
    @param:Value("\${FORWARDER_PENDING_ACQUIRE_MAX_COUNT:1000}") private val pendingAcquireMaxCount: Int,
    @param:Value("\${FORWARDER_PENDING_ACQUIRE_TIMEOUT:5000}") private val pendingAcquireTimeout: Long,
    @param:Value("\${FORWARDER_MAX_LIVE_TIME:60000}") private val maxLiveTime: Long,
    @param:Value("\${FORWARDER_MAX_IDLE_TIME:4000}") private val maxIdleTime: Long,
    @param:Value("\${FORWARDER_ALLOW_H2:false}") private val allowH2: Boolean
) {
    @Bean
    fun webClient(): WebClient {
        val maxBytes =
            org.springframework.util.unit.DataSize.parse(maxInMemory).toBytes().toInt()

        val strategies = ExchangeStrategies.builder()
            .codecs { it.defaultCodecs().maxInMemorySize(maxBytes) }
            .build()

        // Connection pool ~= Undici Pool
        val provider = ConnectionProvider.builder("forwarder-pool")
            .maxConnections(connections)                               // max number of connections
            .pendingAcquireMaxCount(pendingAcquireMaxCount)
            .pendingAcquireTimeout(Duration.ofMillis(pendingAcquireTimeout))
            .maxLifeTime(Duration.ofMillis(maxLiveTime))           // maxLiveTime (forces rotation)
            .maxIdleTime(Duration.ofMillis(maxIdleTime))           // keepAliveTimeout (idle close)
            .evictInBackground(Duration.ofSeconds(30))        // periodic cleanup
            .fifo()                                                 // get the LRU of multiple idle HTTP connections
            .build()

        val protocols = if (allowH2) HttpProtocol.entries.toTypedArray() else arrayOf(HttpProtocol.HTTP11)
        val httpClient = HttpClient
            .create(provider)
            .metrics(true) { uri -> uri.substringBefore('?') }
            .keepAlive(keepAlive)
            // Force HTTP/1.1 so LB sees more connections (no H2 multiplexing)
            // Use the constant your Reactor Netty version provides:
            .protocol(*protocols)
            // Usual connection/socket ergonomics
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5_000)

        return WebClient.builder()
            .exchangeStrategies(strategies)
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .build()
    }
}
