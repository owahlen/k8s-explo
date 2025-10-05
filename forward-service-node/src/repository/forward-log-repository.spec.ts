import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { PgForwardLogRepository } from '@/repository/forward-log-repository.ts';
import type { ForwardLogEntry } from '@/domain/forward-log.ts';

describe('PgForwardLogRepository', () => {
    it('persists a forward log entry using parameterized SQL', async () => {
        const query = vi.fn().mockResolvedValue(undefined);
        const pool = { query } as unknown as Pool;
        const repository = new PgForwardLogRepository(pool);

        const entry: ForwardLogEntry = {
            id: '3d7d1c86-5f0d-4e28-9ce0-e0789dcde111',
            logDate: new Date('2024-01-01T12:00:00.000Z'),
            podName: 'forward-node-1',
            httpStatus: 200,
        };

        await repository.save(entry);

        expect(query).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(
            'INSERT INTO forward_log (id, log_date, pod_name, http_status) VALUES ($1, $2, $3, $4)',
            [entry.id, entry.logDate, entry.podName, entry.httpStatus],
        );
    });
});
