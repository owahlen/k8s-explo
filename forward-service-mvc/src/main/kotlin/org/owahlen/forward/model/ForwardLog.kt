package org.owahlen.forward.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.*

@Entity
@Table(name = "FORWARD_LOG")
data class ForwardLog(
    @Id
    @Column(name = "ID", nullable = false)
    val id: UUID = UUID.randomUUID(),

    @Column(name = "LOG_DATE", nullable = false)
    val logDate: Instant,

    @Column(name = "POD_NAME", nullable = false)
    val podName: String,

    @Column(name = "HTTP_STATUS", nullable = false)
    val httpStatus: Int
) {
    // JPA requires a no-arg constructor. Hibernate can use it to instantiate the entity.
    protected constructor() : this(UUID.randomUUID(), Instant.EPOCH, "", 0)
}
