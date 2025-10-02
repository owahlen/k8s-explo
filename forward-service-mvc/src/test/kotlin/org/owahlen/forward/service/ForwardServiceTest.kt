package org.owahlen.forward.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.sun.net.httpserver.HttpServer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.owahlen.forward.model.ForwardLog
import org.owahlen.forward.repository.ForwardLogRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.annotation.Transactional
import java.net.InetSocketAddress

@SpringBootTest
@Transactional // rollback after tests
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForwardServiceTest {

    companion object {
        private lateinit var upstream: HttpServer

        private fun startIfNeeded() {
            if (!this::upstream.isInitialized) {
                val mapper = ObjectMapper()
                upstream = HttpServer.create(InetSocketAddress(0), 0)
                upstream.createContext("/") { exchange ->
                    val responseMap = mapOf("ok" to true)
                    val json = mapper.writeValueAsBytes(responseMap)
                    exchange.responseHeaders.add("Content-Type", "application/json")
                    exchange.sendResponseHeaders(201, json.size.toLong())
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
        fun props(registry: DynamicPropertyRegistry) {
            startIfNeeded()
            val port = upstream.address.port
            registry.add("FORWARD_BASE_URL") { "http://localhost:$port" }
            registry.add("POD_NAME") { "pod-123" }
        }
    }

    @Autowired
    lateinit var service: ForwardService

    @Autowired
    lateinit var forwardLogRepository: ForwardLogRepository

    @Test
    fun forwardsAndLogs() {
        val req = MockHttpServletRequest().apply {
            method = "POST"
            requestURI = "/svc/path"
            queryString = "a=1&b=two"
            contentType = MediaType.APPLICATION_JSON_VALUE
            setContent("{\"hello\":\"world\"}".toByteArray())
            addHeader(HttpHeaders.USER_AGENT, "JUnit")
        }

        val response = service.forward(req)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat(response.headers.contentType).isEqualTo(MediaType.APPLICATION_JSON)
        assertThat(response.body).isNotNull

        val all: List<ForwardLog> = forwardLogRepository.findAll()
        assertThat(all).hasSize(1)
        val entry = all.first()
        assertThat(entry.podName).isEqualTo("pod-123")
        assertThat(entry.httpStatus).isEqualTo(201)
        assertThat(entry.logDate).isNotNull()
    }
}
