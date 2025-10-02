package org.owahlen.forward.repository

import org.owahlen.forward.model.ForwardLog
import org.springframework.data.jpa.repository.JpaRepository
import java.util.*

interface ForwardLogRepository : JpaRepository<ForwardLog, UUID>
