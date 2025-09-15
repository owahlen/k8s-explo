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

@RestController
class ForwardController(
    private val webClient: WebClient,
    // Inject base URL of the upstream service, default to localhost:3000 if not set
    @param:Value("\${ECHO_BASE_URL:http://localhost:3000}") private val echoBaseUrl: String,
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
        val req = exchange.request

        // Build the target URI by combining the base URL with incoming path + query string
        val targetUri = UriComponentsBuilder
            .fromUriString(echoBaseUrl)
            .path(req.uri.rawPath)
            .query(req.uri.rawQuery)
            .build(true)  // true = keep existing encoding, don't double-encode
            .toUri()

        log.debug("Forwarding to {} {}", req.method, targetUri)

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
            // Forward the incoming request body as a stream of DataBuffers.
            // This way the body is not materialized in memory as a String,
            // but passed through in a reactive, backpressure-aware manner.
            .body(BodyInserters.fromDataBuffers(req.body))

            // Trigger the HTTP exchange and obtain a response.
            // `retrieve()` is a higher-level variant of `exchangeToMono { … }`:
            // it applies default error handling and gives you convenient response extractors.
            .retrieve()

            // Convert the response into a ResponseEntity whose body is a Flux<DataBuffer>.
            // That means we keep the body as a reactive stream, not as a fully collected value.
            // This preserves streaming semantics and allows large/binary payloads to flow through.
            .toEntityFlux(DataBuffer::class.java)

            // Because we are in a Kotlin suspend function,
            // use `awaitSingle()` to turn the Mono<ResponseEntity<Flux<DataBuffer>>>
            // into a concrete ResponseEntity<Flux<DataBuffer>>.
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
    }
}
