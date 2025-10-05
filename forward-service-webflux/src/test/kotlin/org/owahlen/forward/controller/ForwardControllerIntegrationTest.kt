package org.owahlen.forward.controller

import io.micrometer.core.instrument.MeterRegistry
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.extension.ExtendWith
import org.owahlen.forward.repository.ForwardLogRepository
import org.owahlen.forward.support.EchoUpstreamServer
import org.owahlen.forward.support.ForwardLogCleanupExtension
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(ForwardLogCleanupExtension::class)
class ForwardControllerIntegrationTest {

    @Autowired
    lateinit var client: WebTestClient

    @Autowired
    lateinit var meterRegistry: MeterRegistry

    @Autowired
    lateinit var forwardLogRepository: ForwardLogRepository

    companion object {
        @JvmStatic
        @AfterAll
        fun shutdownInfrastructure() {
            EchoUpstreamServer.shutdown()
        }

        @Suppress("unused")
        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            EchoUpstreamServer.registerBaseUrl(registry)
            registry.add("management.otlp.metrics.export.enabled") { false }
        }
    }

    @Test
    fun forwardsGetWithQuery() {
        client.get()
            .uri("/foo/bar?x=1&y=2")
            .exchange()
            .expectStatus().isOk
            .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
            .expectBody()
            .jsonPath("$.method").isEqualTo("GET")
            .jsonPath("$.url").value<String> { url ->
                assert(url.endsWith("/foo/bar?x=1&y=2"))
            }
    }

    @Test
    fun forwardsPostBody() {
        val payload = mapOf("hello" to "world", "n" to 42)

        client.post()
            .uri("/echo/test")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(payload)
            .exchange()
            .expectStatus().isOk
            .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
            .expectBody()
            .jsonPath("$.method").isEqualTo("POST")
            .jsonPath("$.body.hello").isEqualTo("world")
            .jsonPath("$.body.n").isEqualTo(42)
    }

    @Test
    fun recordsServerRequestMetric() {
        client.get().uri("/metrics-check").exchange().expectStatus().isOk

        val responseTimer = meterRegistry.find("reactor.netty.http.client.response.time")
            .tags("uri", "/metrics-check", "method", "GET", "status", "200")
            .timer()
        assertThat(responseTimer).isNotNull()
        assertThat(responseTimer!!.count()).isGreaterThan(0)
        assertThat(responseTimer.totalTime(java.util.concurrent.TimeUnit.SECONDS)).isGreaterThanOrEqualTo(0.0)
    }

    @Test
    fun logsForwardedRequests(): Unit = runBlocking {
        client.get().uri("/log-check").exchange().expectStatus().isOk

        val logs = forwardLogRepository.findAll().toList()
        assertThat(logs).hasSize(1)
        val entry = logs.first()
        assertThat(entry.httpStatus).isEqualTo(200)
        assertThat(entry.podName).isEqualTo("forward-service-webflux")
    }
}
