package org.owahlen.forward.controller

import org.springframework.core.io.buffer.DataBuffer
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ServerWebExchange
import org.owahlen.forward.service.ForwardService
import reactor.core.publisher.Flux

@RestController
class ForwardController(
    private val forwardService: ForwardService
) {
    // Catch-all mapping: forward every request that isn't handled earlier
    // such as the /actuator/health endpoint
    @RequestMapping("/**")
    suspend fun forward(exchange: ServerWebExchange): ResponseEntity<Flux<DataBuffer>> =
        forwardService.forward(exchange)
}
