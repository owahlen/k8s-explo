import type { ForwardLogRepository } from '@/repository/forward-log-repository.ts';
import { PgForwardLogRepository } from '@/repository/forward-log-repository.ts';
import { getPool } from '@/infra/database.ts';

export const createForwardLogRepository = (): ForwardLogRepository => {
    return new PgForwardLogRepository(getPool());
};

export type { ForwardLogRepository };
