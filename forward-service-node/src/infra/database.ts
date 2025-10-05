import { Pool, type PoolConfig } from 'pg';
import { env } from '@/config/env.ts';
import logger from '@/infra/logger.ts';

let pool: Pool | null = null;

const buildPoolConfig = (): PoolConfig => {
    const config: PoolConfig = {
        connectionString: env.database.connectionString,
        max: env.database.pool.max,
        idleTimeoutMillis: env.database.pool.idleTimeoutMillis,
        connectionTimeoutMillis: env.database.pool.connectionTimeoutMillis,
    };

    if (env.database.user) {
        config.user = env.database.user;
    }

    if (env.database.password) {
        config.password = env.database.password;
    }

    if (env.database.ssl) {
        config.ssl = { rejectUnauthorized: false };
    }

    return config;
};

export const getPool = (): Pool => {
    if (!pool) {
        const config = buildPoolConfig();
        pool = new Pool(config);
        pool.on('error', (err) => {
            logger.error(`Unexpected Postgres error: ${err.message}`);
        });
    }

    return pool;
};

export const closePool = async (): Promise<void> => {
    if (pool) {
        await pool.end();
        pool = null;
    }
};
