import request from 'supertest';
import {viteNodeApp} from './index.ts';
import {Server} from 'http';
import {afterAll, beforeAll, describe, expect, it} from 'vitest'

describe('Echo Service API', () => {
    let server: Server;

    beforeAll(async () => {
        await new Promise<void>((resolve) => {
            server = viteNodeApp.listen(0, () => {
                resolve();
            });
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    it('should respond to a GET request with a 200 status and a JSON body', async () => {
        const response = await request(viteNodeApp).get('/hello');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toHaveProperty('method', 'GET');
        expect(response.body).toHaveProperty('url', '/hello');
        expect(response.body).toHaveProperty('headers');
    });

    it('should respond to a POST request with the request body echoed back', async () => {
        const postData = {message: 'hello world'};
        const response = await request(viteNodeApp).post('/data').send(postData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('method', 'POST');
        expect(response.body).toHaveProperty('url', '/data');
        expect(response.body).toHaveProperty('body', postData);
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
