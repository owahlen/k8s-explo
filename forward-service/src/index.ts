import express, {Request, Response} from 'express';
import logger from './logger.ts';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {recordRequest, startMetrics} from "./metrics.ts";
import Undici from "undici";
import fetch = Undici.fetch;
import Pool = Undici.Pool;

// Map of origin -> Pool
const originPools = new Map<string, Pool>();

function getPoolFor(origin: string): Pool {
    let pool = originPools.get(origin);
    if (!pool) {
        pool = new Pool(origin, {
            pipelining: 0 // disable keep-alive
        });
        originPools.set(origin, pool);
        logger.info(`Created Pool for origin: ${origin}`);
    }
    return pool;
}

const app = express();
const port = process.env.PORT || 3001;

startMetrics();
app.use(express.json());

app.get('/health', (_: Request, res: Response) => {
    const healthInfo = {
        status: 'ok',
        uptime: process.uptime(), // seconds the process has been running
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(), // rss, heapTotal, heapUsed, external, etc.
    };
    logger.debug(`Health check response: ${JSON.stringify(healthInfo, null, 2)}`);
    res.status(200).json(healthInfo);
});

app.use(async (req: Request, res: Response) => {
    const start = Date.now();
    const upstreamBase = process.env.ECHO_BASE_URL || 'http://localhost:3000';
    const upstreamOrigin = new URL(upstreamBase).origin;
    const targetUrl = new URL(req.originalUrl, upstreamBase).toString();

    logger.http(`Forwarding ${req.method} ${req.originalUrl} -> ${targetUrl}`);

    try {
        const body =
            (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
                ? (Object.keys(req.body || {}).length ? JSON.stringify(req.body) : undefined)
                : undefined;

        const dispatcher = getPoolFor(upstreamOrigin);

        const upstream = await fetch(targetUrl, {
            method: req.method,
            headers: {'content-type': 'application/json'},
            body,
            dispatcher,
        });

        const text = await upstream.text();
        let data: any;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        logger.debug(`Upstream response ${upstream.status}: ${JSON.stringify(data, null, 2)}`);
        res.status(upstream.status).json(data);
    } catch (err: any) {
        logger.error(`Forward error: ${err?.stack || err?.message || String(err)}`);
        res.status(502).json({error: 'Bad Gateway', detail: 'Failed to reach upstream echo-service'});
    } finally {
        recordRequest(req.path, Date.now() - start);
    }
});

export const viteNodeApp = app;

const isRunDirect =
    (typeof require !== 'undefined' && typeof module !== 'undefined')
        ? require.main === module
        : (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url));

if (isRunDirect) {
    app.listen(port, () => {
        const upstreamBase = process.env.ECHO_BASE_URL || 'http://localhost:3000';
        logger.info(`Forward service is listening on http://localhost:${port} (upstream: ${upstreamBase})`);
    });

    // Graceful shutdown: close all pools
    const shutdown = () => {
        for (const [origin, pool] of originPools) {
            pool.close().catch((err: any) =>
                logger.warn(`Error closing pool for ${origin}: ${err}`)
            );
        }
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
