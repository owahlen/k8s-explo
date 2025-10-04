package org.owahlen.forward.service

import kotlinx.coroutines.reactor.awaitSingle
import org.owahlen.forward.model.ForwardLog
import org.owahlen.forward.repository.ForwardLogRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.buffer.DataBuffer
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.BodyInserters
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.util.UriComponentsBuilder
import reactor.core.publisher.Flux
import java.time.Instant

@Service
class ForwardService(
    private val webClient: WebClient,
    private val forwardLogRepository: ForwardLogRepository,
    @param:Value("\${FORWARD_BASE_URL:http://localhost:5173}") private val echoBaseUrl: String,
    @param:Value("\${POD_NAME:forward-service-webflux}") private val podName: String
) {
    private val log = LoggerFactory.getLogger(ForwardService::class.java)

    private val skipHeaders = setOf(
        HttpHeaders.HOST,
        HttpHeaders.CONTENT_LENGTH,
        HttpHeaders.ACCEPT_ENCODING,
        HttpHeaders.TRANSFER_ENCODING
    )

    suspend fun forward(exchange: ServerWebExchange): ResponseEntity<Flux<DataBuffer>> {
        val request = exchange.request
        val method = requireNotNull(request.method) { "HTTP method is required" }

        val targetUri = UriComponentsBuilder
            .fromUriString(echoBaseUrl)
            .path(request.uri.rawPath)
            .query(request.uri.rawQuery)
            .build(true)
            .toUri()

        log.debug("Forwarding to {} {}", method, targetUri)

        val requestSpec = webClient
            .method(method)
            .uri(targetUri)
            .headers { headers ->
                request.headers.forEach { (name, values) ->
                    if (!skipHeaders.contains(name)) headers[name] = values
                }
            }
            .cookies { cookies ->
                request.cookies.forEach { (name, values) ->
                    values.forEach { cookie -> cookies.add(name, cookie.value) }
                }
            }

        val upstream = requestSpec
            .body(BodyInserters.fromDataBuffers(request.body))
            .retrieve()
            .toEntityFlux(DataBuffer::class.java)
            .awaitSingle()

        persistLogEntry(upstream.statusCode.value())

        val responseHeaders = HttpHeaders()
        upstream.headers.forEach { (name, values) ->
            if (!skipHeaders.contains(name)) responseHeaders[name] = values
        }

        return ResponseEntity.status(upstream.statusCode)
            .headers(responseHeaders)
            .body(upstream.body ?: Flux.empty())
    }

    private suspend fun persistLogEntry(statusCode: Int) {
        val entry = ForwardLog(
            logDate = Instant.now(),
            podName = podName,
            httpStatus = statusCode
        )

        runCatching { forwardLogRepository.save(entry) }
            .onFailure { ex ->
                log.warn("Failed to write forward log entry", ex)
            }
    }
}
