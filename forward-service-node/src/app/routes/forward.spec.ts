import express from 'express';
import request from 'supertest';
import { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ForwardService } from '@/service/forward-service.ts';
import { buildApp } from '@/app/index.ts';
import type { NewForwardLogEntry } from '@/db/schema/forwardLog.ts';

process.env.OTEL_ENABLED = 'false';
process.env.POD_NAME = 'test-pod';
process.env.DB_POOL_MAX = '2';

type DbMock = {
    db: any;
    entries: NewForwardLogEntry[];
    insertMock: ReturnType<typeof vi.fn>;
    valuesMock: ReturnType<typeof vi.fn>;
};

const createDbMock = (): DbMock => {
    const entries: NewForwardLogEntry[] = [];
    const valuesMock = vi.fn(async (row: NewForwardLogEntry) => {
        entries.push(row);
    });
    const insertMock = vi.fn(() => ({ values: valuesMock }));
    return {
        db: { insert: insertMock } as any,
        entries,
        insertMock,
        valuesMock,
    };
};

describe('Forward Service API', () => {
    let upstream: Server;
    let forward: Server;
    let upstreamPort: number;
    let app: import('express').Express;
    let dbMock: DbMock;

    beforeAll(async () => {
        const upstreamApp = express();
        upstreamApp.use(express.json());
        upstreamApp.use((req, res) => {
            res.status(200).json({
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
                body: req.body || null,
                query: req.query || null,
                pod_name: 'upstream-pod',
            });
        });

        await new Promise<void>((resolve) => {
            upstream = upstreamApp.listen(0, () => {
                const addr = upstream.address();
                if (typeof addr === 'object' && addr && addr.port) {
                    upstreamPort = addr.port;
                    resolve();
                } else {
                    throw new Error('Failed to determine upstream port');
                }
            });
        });

        process.env.FORWARD_BASE_URL = `http://127.0.0.1:${upstreamPort}`;

        dbMock = createDbMock();
        const forwardService = new ForwardService({
            db: dbMock.db as any,
            baseUrl: process.env.FORWARD_BASE_URL,
            podName: process.env.POD_NAME,
            requestTimeout: 5_000,
        });

        app = buildApp({ forwardService });

        await new Promise<void>((resolve) => {
            forward = app.listen(0, () => resolve());
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => forward?.close(() => resolve()));
        await new Promise<void>((resolve) => upstream?.close(() => resolve()));

        const { closeAgent } = await import('@/http/agent.ts');
        await closeAgent();
    });

    it('forwards GET and returns upstream JSON', async () => {
        const before = dbMock.entries.length;
        const res = await request(app).get('/hello?client=test');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body).toHaveProperty('method', 'GET');
        expect(res.body).toHaveProperty('url', '/hello?client=test');

        expect(dbMock.entries.length).toBe(before + 1);
        const entry = dbMock.entries.at(-1);
        expect(entry).toBeDefined();
        expect(entry?.httpStatus).toBe(200);
        expect(entry?.podName).toBe('test-pod');
        expect(entry?.targetPodName).toBe('upstream-pod');
    });

    it('forwards POST body and mirrors upstream response', async () => {
        const payload = { message: 'forward me' };
        const before = dbMock.entries.length;

        const res = await request(app).post('/data').send(payload);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('method', 'POST');
        expect(res.body).toHaveProperty('url', '/data');
        expect(res.body).toHaveProperty('body');
        expect(res.body.body).toEqual(payload);

        expect(dbMock.entries.length).toBe(before + 1);
        const entry = dbMock.entries.at(-1);
        expect(entry?.httpStatus).toBe(200);
        expect(entry?.targetPodName).toBe('upstream-pod');
    });

    it('logs 502 when upstream is unavailable', async () => {
        const failingDb = createDbMock();
        const failingService = new ForwardService({
            db: failingDb.db as any,
            baseUrl: 'http://127.0.0.1:59999',
            podName: 'test-pod',
            requestTimeout: 100,
        });
        const failingApp = buildApp({ forwardService: failingService });

        const response = await request(failingApp).get('/unavailable');
        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: 'Bad Gateway', detail: 'Failed to reach upstream' });
        const logCall = failingDb.valuesMock.mock.calls.at(-1)?.[0] as NewForwardLogEntry | undefined;
        expect(logCall?.httpStatus).toBe(502);
        expect(logCall?.targetPodName).toBe('unknown');
    });

    it('continues response flow when database insert rejects', async () => {
        const failingDb = createDbMock();
        failingDb.valuesMock.mockRejectedValueOnce(new Error('db down'));
        const service = new ForwardService({
            db: failingDb.db as any,
            baseUrl: process.env.FORWARD_BASE_URL,
            podName: process.env.POD_NAME,
            requestTimeout: 5_000,
        });
        const testApp = buildApp({ forwardService: service });

        const res = await request(testApp).get('/still-works');
        expect(res.status).toBe(200);
        expect(failingDb.valuesMock).toHaveBeenCalledTimes(1);
        const attempted = failingDb.valuesMock.mock.calls.at(-1)?.[0] as NewForwardLogEntry | undefined;
        expect(attempted?.targetPodName).toBe('upstream-pod');
    });
});
