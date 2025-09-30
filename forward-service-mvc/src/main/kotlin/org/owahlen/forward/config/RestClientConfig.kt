package org.owahlen.forward.config

import org.apache.hc.client5.http.config.RequestConfig
import org.apache.hc.client5.http.config.ConnectionConfig
import org.apache.hc.client5.http.impl.classic.HttpClients
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder
import org.apache.hc.core5.pool.PoolConcurrencyPolicy
import org.apache.hc.core5.pool.PoolReusePolicy
import org.apache.hc.core5.util.TimeValue
import org.apache.hc.core5.util.Timeout
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory
import org.springframework.web.client.RestClient

@Configuration
class RestClientConfig(
    @param:Value("\${CLIENT_MAX_CONNECTIONS:8}") private val maxConnections: Int,
) {
    @Bean
    fun restClientBuilder(): RestClient.Builder {
        val connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
            .setMaxConnTotal(8 * maxConnections)
            .setMaxConnPerRoute(maxConnections)
            .setDefaultConnectionConfig(
                ConnectionConfig.custom()
                    .setTimeToLive(TimeValue.ofMilliseconds(60000)) // max lifetime
                    .build()
            )
            .setPoolConcurrencyPolicy(PoolConcurrencyPolicy.LAX)
            .setConnPoolPolicy(PoolReusePolicy.LIFO)
            .build()

        val requestConfig = RequestConfig.custom()
            .setConnectionRequestTimeout(Timeout.ofMilliseconds(5000)) // pending acquire timeout
            .setResponseTimeout(Timeout.ofMilliseconds(30000)) // no global response timeout by default
            .build()

        val httpClient = HttpClients.custom()
            .setConnectionManager(connectionManager)
            .setDefaultRequestConfig(requestConfig)
            .evictExpiredConnections() // respect connection maxLifeTime/TTL
            .evictIdleConnections(TimeValue.ofMilliseconds(4000)) // keepAliveTimeout (idle close)
            .build()

        val factory = HttpComponentsClientHttpRequestFactory(httpClient)
        return RestClient.builder().requestFactory(factory)
    }
}
