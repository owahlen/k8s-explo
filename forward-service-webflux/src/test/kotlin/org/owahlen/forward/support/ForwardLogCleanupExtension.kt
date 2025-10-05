package org.owahlen.forward.support

import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.extension.BeforeEachCallback
import org.junit.jupiter.api.extension.ExtensionContext
import org.owahlen.forward.repository.ForwardLogRepository
import org.springframework.test.context.junit.jupiter.SpringExtension

class ForwardLogCleanupExtension : BeforeEachCallback {

    override fun beforeEach(context: ExtensionContext) {
        val applicationContext = SpringExtension.getApplicationContext(context)
        val forwardLogRepository = applicationContext.getBean(ForwardLogRepository::class.java)

        runBlocking {
            forwardLogRepository.deleteAll()
        }
    }
}
