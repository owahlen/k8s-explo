package org.owahlen.forward.controller

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder

@RestController
class ForwardController(
    private val restClientBuilder: RestClient.Builder,
    @param:Value("\${FORWARD_BASE_URL:http://localhost:5173}") private val echoBaseUrl: String
) {
    private val log = LoggerFactory.getLogger(ForwardController::class.java)

    private val skipHeaders = setOf(
        HttpHeaders.HOST,
        HttpHeaders.CONTENT_LENGTH,
        HttpHeaders.ACCEPT_ENCODING,
        HttpHeaders.TRANSFER_ENCODING
    )

    @RequestMapping("/**")
    fun forward(request: HttpServletRequest): ResponseEntity<ByteArray> {
        val targetUri = UriComponentsBuilder
            .fromUriString(echoBaseUrl)
            .path(request.requestURI)
            .query(request.queryString)
            .build(true)
            .toUri()

        val method = HttpMethod.valueOf(request.method)
        log.debug("Forwarding to {} {}", method, targetUri)

        val bodyBytes = request.inputStream.readAllBytes()

        val client = restClientBuilder.build()
        val responseSpec = client
            .method(method)
            .uri(targetUri)
            .headers { headers ->
                request.headerNames.asIterator().forEachRemaining { name ->
                    if (!skipHeaders.contains(name)) {
                        val values = request.getHeaders(name)
                        headers[name] = values.toList()
                    }
                }
            }

        val upstream = if (bodyBytes.isNotEmpty()) {
            responseSpec
                .body(bodyBytes)
                .retrieve()
                .toEntity(ByteArray::class.java)
        } else {
            responseSpec
                .retrieve()
                .toEntity(ByteArray::class.java)
        }

        val respHeaders = HttpHeaders()
        upstream.headers.forEach { (k, v) ->
            if (!skipHeaders.contains(k)) respHeaders[k] = v
        }

        return ResponseEntity.status(upstream.statusCode)
            .headers(respHeaders)
            .body(upstream.body ?: ByteArray(0))
    }
}
