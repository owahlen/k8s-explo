package org.owahlen.forward.repository

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.owahlen.forward.model.ForwardLog
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@DataJpaTest
@Transactional // rollback after tests
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ForwardLogRepositoryTest {

    @Autowired
    lateinit var repository: ForwardLogRepository

    @Test
    fun savesAndReadsForwardLog() {
        val saved = repository.save(
            ForwardLog(
                logDate = Instant.parse("2025-01-01T12:00:00Z"),
                podName = "test-pod",
                httpStatus = 200
            )
        )
        assertThat(saved.id).isNotNull
        val found = repository.findById(saved.id!!)
        assertThat(found).isPresent
        assertThat(found.get().podName).isEqualTo("test-pod")
        assertThat(repository.count()).isEqualTo(1)
    }
}
