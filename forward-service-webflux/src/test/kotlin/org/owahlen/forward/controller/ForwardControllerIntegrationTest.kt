package org.owahlen.forward.controller

import com.fasterxml.jackson.databind.ObjectMapper
import io.micrometer.core.instrument.MeterRegistry
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import reactor.core.publisher.Mono
import reactor.netty.DisposableServer
import reactor.netty.http.server.HttpServer

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForwardControllerIntegrationTest {

    @Autowired
    lateinit var client: WebTestClient

    @Autowired
    lateinit var meterRegistry: MeterRegistry

    companion object {
        // Holds a class level reference to the fake upstream server (Reactor Netty HTTP server)
        private lateinit var upstream: DisposableServer

        // Starts the fake upstream if it hasn't been started yet
        private fun startIfNeeded() {
            if (!this::upstream.isInitialized) {
                val mapper = ObjectMapper()

                upstream = HttpServer.create()
                    .port(0) // bind to a random available port
                    .route { routes ->
                        // For every request (route predicate `{ true }` = match all)
                        routes.route({ true }) { req, res ->
                            req.receive().aggregate().asString().defaultIfEmpty("").flatMap { body ->
                                // Build a map describing the request
                                val responseMap = mutableMapOf<String, Any>(
                                    "method" to req.method().name(),
                                    "url" to req.uri()
                                )

                                if (body.isNotBlank()) {
                                    // Try to parse body as JSON; fall back to string if invalid
                                    val bodyValue: Any = try {
                                        mapper.readTree(body)
                                    } catch (_: Exception) {
                                        body
                                    }
                                    responseMap["body"] = bodyValue
                                }

                                val json = mapper.writeValueAsString(responseMap)

                                res.header("content-type", "application/json")
                                    .sendString(Mono.just(json))
                                    .then()
                            }
                        }
                    }
                    .bindNow() // start the server immediately and block until bound
            }
        }

        // Runs once after all tests: shut down the fake upstream if it was started
        @JvmStatic
        @AfterAll
        fun stopUpstream() {
            if (this::upstream.isInitialized) upstream.disposeNow()
        }

        // This method uses @DynamicPropertySource to provide dynamic properties to the Spring Boot test environment.
        // Spring invokes it before the ApplicationContext is created.
        // As a result, the fake upstream server is started, binds to a random free port,
        // and the computed URL is registered under FORWARD_BASE_URL.
        // Any Spring beans with @Value("\${FORWARD_BASE_URL}") will then receive the correct URL
        // of the fake upstream server.
        @Suppress("unused")
        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            startIfNeeded()
            registry.add("FORWARD_BASE_URL") { "http://localhost:${upstream.port()}" }
            // disable network connections for the otlp exporter
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
        // Act – make a request that your controller forwards
        client.get().uri("/metrics-check").exchange().expectStatus().isOk

        // Assert – Reactor Netty HTTP client metrics exist and record values
        val responseTimer = meterRegistry.find("reactor.netty.http.client.response.time")
            .tags("uri", "/metrics-check", "method", "GET", "status", "200")
            .timer()
        assertThat(responseTimer).isNotNull()
        assertThat(responseTimer!!.count()).isGreaterThan(0)
        // Accept totalTime being 0.0 for extremely fast requests
        assertThat(responseTimer.totalTime(java.util.concurrent.TimeUnit.SECONDS)).isGreaterThanOrEqualTo(0.0)
    }

}
