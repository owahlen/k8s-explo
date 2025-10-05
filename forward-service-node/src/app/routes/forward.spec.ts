import express from 'express';
import request from 'supertest';
import { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ForwardLogRepository } from '@/repository/index.ts';
import type { ForwardLogEntry } from '@/domain/forward-log.ts';
import { ForwardService } from '@/service/forward-service.ts';
import { buildApp } from '@/app/index.ts';

// Configure env BEFORE importing the app
process.env.OTEL_ENABLED = 'false';
process.env.POD_NAME = 'test-pod';
process.env.DB_POOL_MAX = '2'; // ensure parsing coverage if env module loads defaults

class InMemoryForwardLogRepository implements ForwardLogRepository {
    public readonly entries: ForwardLogEntry[] = [];

    async save(entry: ForwardLogEntry): Promise<void> {
        this.entries.push(entry);
    }
}

describe('Forward Service API', () => {
    let upstream: Server;
    let forward: Server;
    let upstreamPort: number;
    let app: import('express').Express;
    let repository: InMemoryForwardLogRepository;

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

        repository = new InMemoryForwardLogRepository();
        const forwardService = new ForwardService({
            repository,
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
        const before = repository.entries.length;
        const res = await request(app).get('/hello?client=test');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body).toHaveProperty('method', 'GET');
        expect(res.body).toHaveProperty('url', '/hello?client=test');

        expect(repository.entries.length).toBe(before + 1);
        const entry = repository.entries.at(-1);
        expect(entry).toBeDefined();
        expect(entry?.httpStatus).toBe(200);
        expect(entry?.podName).toBe('test-pod');
    });

    it('forwards POST body and mirrors upstream response', async () => {
        const payload = { message: 'forward me' };
        const before = repository.entries.length;

        const res = await request(app).post('/data').send(payload);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('method', 'POST');
        expect(res.body).toHaveProperty('url', '/data');
        expect(res.body).toHaveProperty('body');
        expect(res.body.body).toEqual(payload);

        expect(repository.entries.length).toBe(before + 1);
        const entry = repository.entries.at(-1);
        expect(entry?.httpStatus).toBe(200);
    });

    it('logs 502 when upstream is unavailable', async () => {
        const failingRepository = new InMemoryForwardLogRepository();
        const failingService = new ForwardService({
            repository: failingRepository,
            baseUrl: 'http://127.0.0.1:59999',
            podName: 'test-pod',
            requestTimeout: 100,
        });
        const failingApp = buildApp({ forwardService: failingService });

        const response = await request(failingApp).get('/unavailable');
        expect(response.status).toBe(502);
        expect(response.body).toEqual({ error: 'Bad Gateway', detail: 'Failed to reach upstream' });
        expect(failingRepository.entries.at(-1)?.httpStatus).toBe(502);
    });

    it('continues response flow when repository throws', async () => {
        const failingRepo: ForwardLogRepository = {
            save: vi.fn().mockRejectedValue(new Error('db down')),
        };
        const service = new ForwardService({
            repository: failingRepo,
            baseUrl: process.env.FORWARD_BASE_URL,
            podName: process.env.POD_NAME,
            requestTimeout: 5_000,
        });
        const testApp = buildApp({ forwardService: service });

        const res = await request(testApp).get('/still-works');
        expect(res.status).toBe(200);
    });
});
