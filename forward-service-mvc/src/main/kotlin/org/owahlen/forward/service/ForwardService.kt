package org.owahlen.forward.service

import jakarta.servlet.http.HttpServletRequest
import org.owahlen.forward.model.ForwardLog
import org.owahlen.forward.repository.ForwardLogRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import java.time.Instant

@Service
class ForwardService(
    private val restClientBuilder: RestClient.Builder,
    private val forwardLogRepository: ForwardLogRepository,
    @param:Value("\${FORWARD_BASE_URL:http://localhost:3000}") private val echoBaseUrl: String,
    @param:Value("\${POD_NAME:forward-service-mvc}") private val podName: String
) {
    private val log = LoggerFactory.getLogger(ForwardService::class.java)

    private val skipHeaders = setOf(
        HttpHeaders.HOST,
        HttpHeaders.CONTENT_LENGTH,
        HttpHeaders.ACCEPT_ENCODING,
        HttpHeaders.TRANSFER_ENCODING
    )

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

        // Log the result to the database using repository
        val entry = ForwardLog(
            logDate = Instant.now(),
            podName = podName,
            httpStatus = upstream.statusCode.value()
        )
        forwardLogRepository.save(entry)

        val respHeaders = HttpHeaders()
        upstream.headers.forEach { (k, v) ->
            if (!skipHeaders.contains(k)) respHeaders[k] = v
        }

        return ResponseEntity.status(upstream.statusCode)
            .headers(respHeaders)
            .body(upstream.body ?: ByteArray(0))
    }
}
