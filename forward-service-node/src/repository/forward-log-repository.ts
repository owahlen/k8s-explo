import type { Pool } from 'pg';
import { ForwardLogEntry } from '@/domain/forward-log.ts';

export interface ForwardLogRepository {
    save(entry: ForwardLogEntry): Promise<void>;
}

export class PgForwardLogRepository implements ForwardLogRepository {
    constructor(private readonly pool: Pool) {}

    async save(entry: ForwardLogEntry): Promise<void> {
        await this.pool.query(
            'INSERT INTO forward_log (id, log_date, pod_name, http_status) VALUES ($1, $2, $3, $4)',
            [entry.id, entry.logDate, entry.podName, entry.httpStatus],
        );
    }
}
