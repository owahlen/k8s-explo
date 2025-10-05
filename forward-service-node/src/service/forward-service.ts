import type { Request, Response } from 'express';
import Undici from "undici";
import undiciRequest = Undici.request;
import Dispatcher = Undici.Dispatcher;
import { randomUUID } from 'node:crypto';
import logger from '@/infra/logger.ts';
import { env } from '@/config/env.ts';
import type { ForwardLogRepository } from '@/repository/index.ts';
import type { ForwardLogEntry } from '@/domain/forward-log.ts';

const SKIP_REQUEST_HEADERS = new Set([
    'host',
    'connection',
    'content-length',
    'accept-encoding',
    'transfer-encoding',
]);

const SKIP_RESPONSE_HEADERS = new Set([
    'transfer-encoding',
    'content-length',
    'connection',
]);

type HttpClient = typeof undiciRequest;

export interface ForwardServiceDependencies {
    repository: ForwardLogRepository;
    baseUrl?: string;
    podName?: string;
    requestTimeout?: number;
    httpClient?: HttpClient;
}

export interface ForwardResponse {
    statusCode: number;
    headers: Dispatcher.ResponseData['headers'];
    body: string;
}

export class ForwardServiceError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly body?: unknown,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'ForwardServiceError';
    }
}

export class ForwardService {
    private readonly repository: ForwardLogRepository;
    private readonly baseUrl: string;
    private readonly podName: string;
    private readonly requestTimeout: number;
    private readonly httpClient: HttpClient;

    constructor(deps: ForwardServiceDependencies) {
        this.repository = deps.repository;
        this.baseUrl = deps.baseUrl ?? env.forwardBaseURL;
        this.podName = deps.podName ?? env.podName;
        this.requestTimeout = deps.requestTimeout ?? env.requestTimeout;
        this.httpClient = deps.httpClient ?? undiciRequest;
    }

    async forward(req: Request): Promise<ForwardResponse> {
        const method = req.method?.toUpperCase();
        if (!method) {
            throw new ForwardServiceError(500, 'HTTP method is required');
        }

        const targetUrl = new URL(req.originalUrl || '/', this.baseUrl).toString();
        const headers = this.buildRequestHeaders(req);
        const body = this.buildBody(req);

        logger.http(`Forwarding ${method} ${req.originalUrl} -> ${targetUrl}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            const upstream = await this.httpClient(targetUrl, {
                method,
                headers,
                body,
                signal: controller.signal,
            });

            const responseBody = await upstream.body.text();
            await this.persistLogEntry(upstream.statusCode);

            return {
                statusCode: upstream.statusCode,
                headers: upstream.headers,
                body: responseBody,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`Forward error: ${err.message}`);
            await this.persistLogEntry(502);
            throw new ForwardServiceError(502, 'Failed to reach upstream', { error: 'Bad Gateway', detail: 'Failed to reach upstream' }, { cause: err });
        } finally {
            clearTimeout(timeout);
        }
    }

    decorateResponseHeaders(res: Response, headers: Dispatcher.ResponseData['headers']): void {
        Object.entries(headers).forEach(([name, value]) => {
            if (SKIP_RESPONSE_HEADERS.has(name)) {
                return;
            }

            if (Array.isArray(value)) {
                if (value.length > 0) {
                    res.setHeader(name, value);
                }
                return;
            }

            if (typeof value === 'string' || typeof value === 'number') {
                res.setHeader(name, value);
            }
        });
    }

    private buildRequestHeaders(req: Request): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [name, value] of Object.entries(req.headers)) {
            if (SKIP_REQUEST_HEADERS.has(name)) {
                continue;
            }

            if (Array.isArray(value)) {
                if (value.length > 0) {
                    result[name] = value.join(',');
                }
                continue;
            }

            if (value !== undefined) {
                result[name] = value;
            }
        }

        if (!result['content-type'] && req.is('application/json')) {
            result['content-type'] = 'application/json';
        }

        return result;
    }

    private buildBody(req: Request): string | undefined {
        const hasBodyMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method?.toUpperCase() ?? 'GET');
        if (!hasBodyMethod) {
            return undefined;
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            return undefined;
        }

        return JSON.stringify(req.body);
    }

    private async persistLogEntry(statusCode: number): Promise<void> {
        const entry: ForwardLogEntry = {
            id: randomUUID(),
            logDate: new Date(),
            podName: this.podName,
            httpStatus: statusCode,
        };

        try {
            await this.repository.save(entry);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.warn(`Failed to write forward log entry: ${err.message}`);
        }
    }
}

export const SKIP_FORWARD_RESPONSE_HEADERS = SKIP_RESPONSE_HEADERS;
