package org.owahlen.forward.support

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.BeforeEach
import org.owahlen.forward.repository.ForwardLogRepository
import org.springframework.beans.factory.annotation.Autowired

abstract class ForwardLogDatabaseTestSupport {

    @Autowired
    protected lateinit var forwardLogRepository: ForwardLogRepository

    @BeforeEach
    fun clearForwardLogTable(): Unit = runBlocking {
        forwardLogRepository.deleteAll()
    }
}
