package org.owahlen.forward.actuator

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HealthEndpointTest {

    @Autowired
    lateinit var client: WebTestClient

    @Test
    fun healthIsUp() {
        client.get()
            .uri("/actuator/health")
            .exchange()
            .expectStatus().isOk
            .expectHeader().contentTypeCompatibleWith(MediaType.parseMediaType("application/vnd.spring-boot.actuator.v3+json"))
            .expectBody()
            .jsonPath("$.status").isEqualTo("UP")
    }
}
