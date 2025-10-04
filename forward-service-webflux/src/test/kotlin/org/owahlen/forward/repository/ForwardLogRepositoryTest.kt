package org.owahlen.forward.repository

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.owahlen.forward.model.ForwardLog
import org.owahlen.forward.support.ForwardLogDatabaseTestSupport
import org.owahlen.forward.support.R2dbcTestConfig
import org.springframework.boot.test.autoconfigure.data.r2dbc.DataR2dbcTest
import org.springframework.context.annotation.Import
import java.time.Instant

@DataR2dbcTest
@Import(R2dbcTestConfig::class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForwardLogRepositoryTest : ForwardLogDatabaseTestSupport() {

    @Test
    fun savesAndReadsForwardLog(): Unit = runBlocking {
        val saved = forwardLogRepository.save(
            ForwardLog(
                logDate = Instant.parse("2025-01-01T12:00:00Z"),
                podName = "test-pod",
                httpStatus = 201
            )
        )

        val savedId = requireNotNull(saved.id)

        val found = requireNotNull(forwardLogRepository.findById(savedId))
        assertThat(found.podName).isEqualTo("test-pod")

        val all = forwardLogRepository.findAll().toList()
        assertThat(all).hasSize(1)
        assertThat(all.first().httpStatus).isEqualTo(201)

        val count = forwardLogRepository.count()
        assertThat(count).isEqualTo(1)
    }
}
