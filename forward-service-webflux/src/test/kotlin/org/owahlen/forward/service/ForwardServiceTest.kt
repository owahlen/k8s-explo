package org.owahlen.forward.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
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
import org.springframework.core.io.buffer.DataBufferUtils
import org.springframework.http.MediaType
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.web.server.ServerWebExchange
import java.nio.charset.StandardCharsets

@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(ForwardLogCleanupExtension::class)
class ForwardServiceTest {

    @Autowired
    lateinit var forwardService: ForwardService

    @Autowired
    lateinit var forwardLogRepository: ForwardLogRepository

    companion object {
        private const val REQUEST_PAYLOAD = """{"hello":"world"}"""

        @JvmStatic
        @AfterAll
        fun shutdown() {
            EchoUpstreamServer.shutdown()
        }

        @JvmStatic
        @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            EchoUpstreamServer.registerBaseUrl(registry)
            registry.add("POD_NAME") { "pod-xyz" }
            registry.add("management.otlp.metrics.export.enabled") { false }
        }
    }

    @Test
    fun forwardsRequestAndLogsResult(): Unit = runBlocking {
        val exchange = buildExchange()

        val response = forwardService.forward(exchange)

        assertThat(response.statusCode.value()).isEqualTo(200)
        assertThat(response.headers.contentType).isEqualTo(MediaType.APPLICATION_JSON)

        val bodyBytes = response.body
            ?.let { flux -> DataBufferUtils.join(flux).block() }
            ?.let { buffer ->
                val bytes = ByteArray(buffer.readableByteCount())
                buffer.read(bytes)
                DataBufferUtils.release(buffer)
                bytes
            }

        assertThat(bodyBytes).isNotNull
        val json = jacksonObjectMapper().readTree(String(bodyBytes!!, StandardCharsets.UTF_8))
        assertThat(json["method"].asText()).isEqualTo("POST")
        assertThat(json["body"]["hello"].asText()).isEqualTo("world")

        val allLogs = forwardLogRepository.findAll().toList()
        assertThat(allLogs).hasSize(1)
        val entry = allLogs.first()
        assertThat(entry.httpStatus).isEqualTo(200)
        assertThat(entry.podName).isEqualTo("pod-xyz")
    }

    private fun buildExchange(): ServerWebExchange {
        val request = MockServerHttpRequest.post("/svc/path")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Test", "value")
            .body(REQUEST_PAYLOAD)

        return MockServerWebExchange.from(request)
    }
}
