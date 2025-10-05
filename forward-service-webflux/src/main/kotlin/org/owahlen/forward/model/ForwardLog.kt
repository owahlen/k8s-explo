package org.owahlen.forward.model

import org.springframework.data.annotation.Id
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table
import java.time.Instant
import java.util.UUID

@Table("forward_log")
data class ForwardLog(
    @Id
    @Column("id")
    val identifier: UUID = UUID.randomUUID(),
    @Column("log_date")
    val logDate: Instant,
    @Column("pod_name")
    val podName: String,
    @Column("target_pod_name")
    val targetPodName: String,
    @Column("http_status")
    val httpStatus: Int
) : Persistable<UUID> {
    override fun getId(): UUID = identifier
    override fun isNew(): Boolean = true
}
