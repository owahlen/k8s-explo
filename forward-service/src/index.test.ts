import express from 'express';
import request from 'supertest';
import {Server} from 'http';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {viteNodeApp} from './index.ts';

describe('Forward Service API', () => {
    let upstream: Server;
    let forward: Server;
    let upstreamPort: number;

    beforeAll(async () => {
        // Simple upstream echo server to simulate echo-service
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
                } else {
                    throw new Error('Failed to determine upstream port');
                }
                resolve();
            });
        });

        process.env.ECHO_BASE_URL = `http://127.0.0.1:${upstreamPort}`;

        await new Promise<void>((resolve) => {
            forward = viteNodeApp.listen(0, () => resolve());
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => forward.close(() => resolve()));
        await new Promise<void>((resolve) => upstream.close(() => resolve()));
    });

    it('forwards GET and returns upstream JSON', async () => {
        const res = await request(viteNodeApp).get('/hello?client=test');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body).toHaveProperty('method', 'GET');
        expect(res.body).toHaveProperty('url', '/hello?client=test');
    });

    it('forwards POST body and mirrors upstream response', async () => {
        const payload = { message: 'forward me' };
        const res = await request(viteNodeApp).post('/data').send(payload);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('method', 'POST');
        expect(res.body).toHaveProperty('url', '/data');
        expect(res.body).toHaveProperty('body');
        expect(res.body.body).toEqual(payload);
    });

    it('should respond to the health endpoint with status ok', async () => {
        const response = await request(viteNodeApp).get('/health');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('memoryUsage');
    });
});
