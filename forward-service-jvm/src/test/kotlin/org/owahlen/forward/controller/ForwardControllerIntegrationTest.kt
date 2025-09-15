package org.owahlen.forward.controller

import com.fasterxml.jackson.databind.ObjectMapper
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
        // and the computed URL is registered under ECHO_BASE_URL.
        // Any Spring beans with @Value("\${ECHO_BASE_URL}") will then receive the correct URL
        // of the fake upstream server.
        @Suppress("unused")
        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            startIfNeeded()
            registry.add("ECHO_BASE_URL") { "http://localhost:${upstream.port()}" }
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
}
