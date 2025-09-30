package org.owahlen.forward.actuator

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.http.MediaType

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HealthEndpointTest {

    @Autowired
    lateinit var rest: TestRestTemplate

    private val mapper = ObjectMapper()

    @Test
    fun healthIsUp() {
        val response = rest.getForEntity("/actuator/health", String::class.java)
        assertThat(response.statusCode.is2xxSuccessful).isTrue()
        assertThat(response.headers.contentType).isNotNull()
        assertThat(response.headers.contentType!!.isCompatibleWith(MediaType.APPLICATION_JSON)).isTrue()

        val json = mapper.readTree(response.body)
        assertThat(json.path("status").asText()).isEqualTo("UP")
    }
}
