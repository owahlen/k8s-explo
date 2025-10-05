import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Request, Response} from 'express';
import {ForwardService, ForwardServiceError} from '@/service/forward-service.ts';
import type {ForwardLogRepository} from '@/repository/index.ts';
import Undici from "undici";
import undiciRequest = Undici.request;

type HttpClient = typeof undiciRequest;

describe('ForwardService', () => {
    const baseUrl = 'https://example.internal';
    const podName = 'forward-node-pod';

    const createRequest = (overrides: Partial<Request> = {}): Request => {
        const defaultHeaders: Record<string, string> = {
            'content-type': 'application/json',
            'x-forwarded-for': '127.0.0.1',
            connection: 'keep-alive',
        };

        const req = {
            method: 'POST',
            originalUrl: '/api/forward?foo=bar',
            headers: {...defaultHeaders, ...(overrides.headers as Record<string, string> | undefined)},
            body: overrides.body ?? {hello: 'world'},
            is: vi.fn((type: string) => type === 'application/json'),
        } as unknown as Request;

        Object.assign(req, overrides);
        return req;
    };

    const createResponseStub = () => {
        const headers = new Map<string, string | number | readonly string[]>();
        const res = {
            setHeader: vi.fn((name: string, value: string | number | readonly string[]) => {
                headers.set(name, value);
            }),
            getHeader: vi.fn((name: string) => headers.get(name)),
        } as unknown as Response;

        return {res, headers};
    };

    let repository: ForwardLogRepository;
    let httpClient: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        repository = {
            save: vi.fn().mockResolvedValue(undefined),
        } as ForwardLogRepository;

        httpClient = vi.fn();
    });

    it('forwards request to upstream and records log entry', async () => {
        const request = createRequest();
        const bodyPayload = JSON.stringify({hello: 'world'});

        (httpClient as any).mockResolvedValue({
            statusCode: 200,
            headers: {
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
                etag: 'abc123',
            },
            body: {
                text: vi.fn().mockResolvedValue(bodyPayload),
            },
        });

        const service = new ForwardService({
            repository,
            baseUrl,
            podName,
            requestTimeout: 1_000,
            httpClient: httpClient as unknown as HttpClient,
        });

        const response = await service.forward(request);

        expect(httpClient).toHaveBeenCalledTimes(1);
        expect(httpClient).toHaveBeenCalledWith(
            `${baseUrl}${request.originalUrl}`,
            expect.objectContaining({
                method: request.method,
                signal: expect.any(AbortSignal),
                headers: expect.objectContaining({
                    'content-type': 'application/json',
                    'x-forwarded-for': '127.0.0.1',
                }),
                body: JSON.stringify(request.body),
            }),
        );

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(bodyPayload);
        expect(response.headers).toEqual(
            expect.objectContaining({
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
            }),
        );

        expect(repository.save).toHaveBeenCalledTimes(1);
        const entry = (repository.save as any).mock.calls[0][0];
        expect(entry.httpStatus).toBe(200);
        expect(entry.podName).toBe(podName);
    });

    it('throws ForwardServiceError and logs 502 when upstream fails', async () => {
        const request = createRequest({method: 'GET', body: undefined});
        (httpClient as any).mockRejectedValue(new Error('connection refused'));

        const service = new ForwardService({
            repository,
            baseUrl,
            podName,
            requestTimeout: 10,
            httpClient: httpClient as unknown as HttpClient,
        });

        const promise = service.forward(request);
        await expect(promise).rejects.toThrowError(ForwardServiceError);
        await expect(promise).rejects.toMatchObject({statusCode: 502});

        expect(repository.save).toHaveBeenCalled();
        const entry = (repository.save as any).mock.calls.at(-1)[0];
        expect(entry.httpStatus).toBe(502);
    });

    it('continues when repository.save rejects', async () => {
        const request = createRequest();
        const bodyPayload = '{}';

        (httpClient as any).mockResolvedValue({
            statusCode: 204,
            headers: {},
            body: {
                text: vi.fn().mockResolvedValue(bodyPayload),
            },
        });

        (repository.save as any).mockRejectedValue(new Error('db unavailable'));

        const service = new ForwardService({
            repository,
            baseUrl,
            podName,
            requestTimeout: 500,
            httpClient: httpClient as unknown as HttpClient,
        });

        await expect(service.forward(request)).resolves.toMatchObject({
            statusCode: 204,
            body: bodyPayload,
        });

        expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('decorates response headers while skipping hop-by-hop values', () => {
        const service = new ForwardService({
            repository,
            baseUrl,
            podName,
            requestTimeout: 500,
            httpClient: httpClient as unknown as HttpClient,
        });

        const {res, headers} = createResponseStub();
        service.decorateResponseHeaders(res, {
            etag: 'abc',
            'set-cookie': ['first=1', 'second=2'],
            'transfer-encoding': 'chunked',
            connection: 'keep-alive',
            'content-length': '45',
        });

        expect(headers.get('etag')).toBe('abc');
        expect(headers.get('set-cookie')).toEqual(['first=1', 'second=2']);
        expect(headers.has('transfer-encoding')).toBe(false);
        expect(headers.has('connection')).toBe(false);
        expect(headers.has('content-length')).toBe(false);
    });
});
