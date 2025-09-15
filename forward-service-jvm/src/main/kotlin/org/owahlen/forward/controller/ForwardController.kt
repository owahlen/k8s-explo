package org.owahlen.forward.controller

import kotlinx.coroutines.reactor.awaitSingle
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.io.buffer.DataBuffer
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.reactive.function.BodyInserters
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.server.ServerWebExchange
import org.springframework.web.util.UriComponentsBuilder
import reactor.core.publisher.Flux
import org.owahlen.forward.metrics.ForwardMetrics

@RestController
class ForwardController(
    private val webClient: WebClient,
    // Inject base URL of the upstream service, default to localhost:3000 if not set
    @param:Value("\${ECHO_BASE_URL:http://localhost:3000}") private val echoBaseUrl: String,
    private val metrics: ForwardMetrics,
) {
    private val log = LoggerFactory.getLogger(ForwardController::class.java)

    // Headers that should not be forwarded
    // as they are managed by HTTP layer or can break things
    private val skipHeaders = setOf(
        HttpHeaders.HOST,
        HttpHeaders.CONTENT_LENGTH,
        HttpHeaders.ACCEPT_ENCODING,
        HttpHeaders.TRANSFER_ENCODING
    )

    // Catch-all mapping: forward every request that isn't handled earlier
    // as for example the /actuator/health endpoint
    @RequestMapping("/**")
    suspend fun forward(exchange: ServerWebExchange): ResponseEntity<Flux<DataBuffer>> {
        val startNs = System.nanoTime()
        val req = exchange.request

        // Build the target URI by combining the base URL with incoming path + query string
        val targetUri = UriComponentsBuilder
            .fromUriString(echoBaseUrl)
            .path(req.uri.rawPath)
            .query(req.uri.rawQuery)
            .build(true)  // true = keep existing encoding, don't double-encode
            .toUri()

        log.debug("Forwarding to {} {}", req.method, targetUri)

        try {
            // Prepare the outbound request using the injected WebClient
            val requestSpec = webClient
                .method(req.method) // forward same HTTP method
                .uri(targetUri)     // forward to constructed URI
                .headers { out ->   // copy headers, except the skipped ones
                    req.headers.forEach { (k, v) ->
                        if (!skipHeaders.contains(k)) out[k] = v
                    }
                }
                .cookies { out ->   // copy cookies
                    req.cookies.forEach { (name, values) ->
                        values.forEach { cookie -> out.add(name, cookie.value) }
                    }
                }

            // Forward the request body as a stream of DataBuffers
            // and collect the full response (status + headers + body stream)
            val upstream = requestSpec
                .body(BodyInserters.fromDataBuffers(req.body))
                .retrieve()
                .toEntityFlux(DataBuffer::class.java)
                .awaitSingle()

            // Copy response headers from upstream, skipping unsafe ones
            val respHeaders = HttpHeaders()
            upstream.headers.forEach { (k, v) ->
                if (!skipHeaders.contains(k)) respHeaders[k] = v
            }

            // Return the upstream response as-is:
            // same status code, filtered headers, streaming body
            return ResponseEntity.status(upstream.statusCode)
                .headers(respHeaders)
                .body(upstream.body ?: Flux.empty())
        } finally {
            val durationMs = (System.nanoTime() - startNs) / 1_000_000
            metrics.record(req.path.value(), durationMs)
        }
    }
}
