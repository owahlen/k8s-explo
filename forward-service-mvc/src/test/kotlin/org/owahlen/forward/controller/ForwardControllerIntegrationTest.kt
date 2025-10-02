package org.owahlen.forward.controller

import com.fasterxml.jackson.databind.ObjectMapper
import com.sun.net.httpserver.HttpServer
import io.micrometer.core.instrument.MeterRegistry
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.owahlen.forward.repository.ForwardLogRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.net.InetSocketAddress

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForwardControllerIntegrationTest {

    @Autowired
    lateinit var rest: TestRestTemplate

    // do not write to the real database
    @MockitoBean
    lateinit var forwardLogRepository: ForwardLogRepository

    @Autowired
    lateinit var meterRegistry: MeterRegistry

    companion object {
        private lateinit var upstream: HttpServer

        private fun startIfNeeded() {
            if (!this::upstream.isInitialized) {
                val mapper = ObjectMapper()
                upstream = HttpServer.create(InetSocketAddress(0), 0)
                upstream.createContext("/") { exchange ->
                    val method = exchange.requestMethod
                    val uri = exchange.requestURI.toString()
                    val bodyBytes = exchange.requestBody.readAllBytes()

                    val responseMap = mutableMapOf<String, Any>(
                        "method" to method,
                        "url" to uri
                    )

                    if (bodyBytes.isNotEmpty()) {
                        val bodyText = String(bodyBytes)
                        val bodyValue: Any = try {
                            mapper.readTree(bodyText)
                        } catch (_: Exception) {
                            bodyText
                        }
                        responseMap["body"] = bodyValue
                    }

                    val json = mapper.writeValueAsBytes(responseMap)
                    exchange.responseHeaders.add("Content-Type", "application/json")
                    exchange.sendResponseHeaders(200, json.size.toLong())
                    exchange.responseBody.use { it.write(json) }
                }
                upstream.start()
            }
        }

        @JvmStatic
        @AfterAll
        fun stopUpstream() {
            if (this::upstream.isInitialized) upstream.stop(0)
        }

        @Suppress("unused")
        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            startIfNeeded()
            val port = upstream.address.port
            registry.add("FORWARD_BASE_URL") { "http://localhost:$port" }
            registry.add("management.otlp.metrics.export.enabled") { false }
        }
    }

    @Test
    fun forwardsGetWithQuery() {
        val response = rest.getForEntity("/foo/bar?x=1&y=2", String::class.java)
        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.headers.contentType).isEqualTo(MediaType.APPLICATION_JSON)

        val mapper = ObjectMapper()
        val json = mapper.readTree(response.body)
        assertThat(json.path("method").asText()).isEqualTo("GET")
        assertThat(json.path("url").asText()).endsWith("/foo/bar?x=1&y=2")
    }

    @Test
    fun forwardsPostBody() {
        val payload = mapOf("hello" to "world", "n" to 42)
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_JSON
        val request = HttpEntity(payload, headers)

        val response = rest.postForEntity("/echo/test", request, String::class.java)
        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.headers.contentType).isEqualTo(MediaType.APPLICATION_JSON)

        val mapper = ObjectMapper()
        val json = mapper.readTree(response.body)
        assertThat(json.path("method").asText()).isEqualTo("POST")
        assertThat(json.path("body").path("hello").asText()).isEqualTo("world")
        assertThat(json.path("body").path("n").asInt()).isEqualTo(42)
    }

    @Test
    fun recordsServerRequestMetric() {
        rest.getForEntity("/metrics-check", String::class.java)

        val responseTimer = meterRegistry.find("http.client.requests").timer()
        assertThat(responseTimer).isNotNull()
        assertThat(responseTimer!!.count()).isGreaterThan(0)
    }
}
