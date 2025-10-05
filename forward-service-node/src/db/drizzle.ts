import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema/index.ts';
import { env } from '@/config/env.ts';
import logger from '@/infra/logger.ts';

const buildPoolConfig = (): PoolConfig => {
    const config: PoolConfig = env.database;
    if (env.database.ssl) {
        config.ssl = { rejectUnauthorized: false };
    }
    return config;
};

let pool: Pool | null = null;

export const getPool = (): Pool => {
    if (!pool) {
        pool = new Pool(buildPoolConfig());
        pool.on('error', (err) => {
            logger.error(`Unexpected Postgres error: ${err.message}`, { err });
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

export const db = drizzle(getPool(), { schema });
