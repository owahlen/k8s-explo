package org.owahlen.forward.repository

import org.owahlen.forward.model.ForwardLog
import org.springframework.data.repository.kotlin.CoroutineCrudRepository
import java.util.UUID

interface ForwardLogRepository : CoroutineCrudRepository<ForwardLog, UUID>
