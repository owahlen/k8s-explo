package org.owahlen.forward.controller

import jakarta.servlet.http.HttpServletRequest
import org.owahlen.forward.service.ForwardService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class ForwardController(
    private val forwardService: ForwardService
) {
    @RequestMapping("/**")
    fun forward(request: HttpServletRequest): ResponseEntity<ByteArray> =
        forwardService.forward(request)
}
