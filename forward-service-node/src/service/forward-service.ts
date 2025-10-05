import type {Request, Response} from "express";
import Undici from "undici";
import {randomUUID} from "node:crypto";
import logger from "@/infra/logger.ts";
import {env} from "@/config/env.ts";

import {db as drizzleDb} from "@/db/drizzle.ts";
import {forwardLog, type ForwardLogEntry} from "@/db/schema/forwardLog.ts";
import undiciRequest = Undici.request;
import Dispatcher = Undici.Dispatcher;

const SKIP_REQUEST_HEADERS = new Set([
    "host",
    "connection",
    "content-length",
    "accept-encoding",
    "transfer-encoding",
]);

const SKIP_RESPONSE_HEADERS = new Set([
    "transfer-encoding",
    "content-length",
    "connection",
]);

type HttpClient = typeof undiciRequest;

/**
 * Optional configuration for {@link ForwardService}.
 * All fields have sensible defaults (env or global singletons).
 */
export interface ForwardServiceOptions {
    db?: typeof drizzleDb;
    baseUrl?: string;
    podName?: string;
    requestTimeout?: number;
    httpClient?: HttpClient;
}

/**
 * Shape of the response from {@link ForwardService.forward}.
 */
export interface ForwardResponse {
    statusCode: number;
    headers: Dispatcher.ResponseData["headers"];
    body: string;
}

/**
 * Error thrown by {@link ForwardService} on forwarding failures.
 */
export class ForwardServiceError extends Error {
    /**
     * @param statusCode HTTP status code to surface to the caller (e.g., 502 for upstream failures).
     * @param message    Human-readable message.
     * @param body       Optional machine-friendly error payload to return/log.
     * @param options    Native `Error` options (e.g., `{ cause }`).
     */
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly body?: unknown,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = "ForwardServiceError";
    }
}

/**
 * Service that forwards incoming HTTP requests to an upstream server and
 * persists a log entry in `public.forward_log` using Drizzle.
 *
 * - Stateless: does not keep per-request mutable state on the instance.
 * - Testable: pass a mocked `db` or `httpClient` via {@link ForwardServiceOptions}.
 * - Resilient: logs any DB write failures but does not fail the HTTP flow because of them.
 */
export class ForwardService {
    private readonly db: typeof drizzleDb;
    private readonly baseUrl: string;
    private readonly podName: string;
    private readonly requestTimeout: number;
    private readonly httpClient: HttpClient;
    private static readonly DEFAULT_TARGET_POD_NAME = "unknown";

    /**
     * Create a new {@link ForwardService}.
     * @param opts Optional overrides for DB, upstream base URL, timeouts, etc.
     *
     * @example
     * ```ts
     * const svc = new ForwardService({ baseUrl: "https://api.example.com" });
     * ```
     */
    constructor(opts: ForwardServiceOptions = {}) {
        this.db = opts.db ?? drizzleDb;
        this.baseUrl = opts.baseUrl ?? env.forwardBaseURL;
        this.podName = opts.podName ?? env.podName;
        this.requestTimeout = opts.requestTimeout ?? env.requestTimeout;
        this.httpClient = opts.httpClient ?? undiciRequest;
    }

    /**
     * Forwards the given Express {@link Request} to the configured upstream `baseUrl`,
     * copying headers/body (with a safe allowlist) and returning the upstream response.
     * Always writes a forward-log row with the upstream status (or `502` on failure).
     *
     * @param req Express request to forward.
     * @returns Upstream status, headers, and body as text.
     *
     * @throws {@link ForwardServiceError}
     * If the upstream cannot be reached within the timeout or an HTTP/network error occurs.
     *
     * @example
     * ```ts
     * app.all("/forward/*", async (req, res) => {
     *   const out = await forwardService.forward(req);
     *   forwardService.decorateResponseHeaders(res, out.headers);
     *   res.status(out.statusCode).send(out.body);
     * });
     * ```
     */
    async forward(req: Request): Promise<ForwardResponse> {
        const method = req.method?.toUpperCase();
        if (!method) {
            throw new ForwardServiceError(500, "HTTP method is required");
        }

        const targetUrl = new URL(req.originalUrl || "/", this.baseUrl).toString();
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
            const targetPodName = this.extractTargetPodName(upstream.headers, responseBody);
            await this.persistLogEntry(upstream.statusCode, targetPodName);

            return {
                statusCode: upstream.statusCode,
                headers: upstream.headers,
                body: responseBody,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`Forward error: ${err.message}`);
            await this.persistLogEntry(502);
            throw new ForwardServiceError(
                502,
                "Failed to reach upstream",
                {error: "Bad Gateway", detail: "Failed to reach upstream"},
                {cause: err}
            );
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Copies upstream response headers onto an Express {@link Response},
     * skipping hop-by-hop/unsafe headers (e.g., `transfer-encoding`, `content-length`, `connection`).
     *
     * @param res     Express response object to mutate.
     * @param headers Upstream headers returned from Undici.
     */
    decorateResponseHeaders(
        res: Response,
        headers: Dispatcher.ResponseData["headers"]
    ): void {
        Object.entries(headers).forEach(([name, value]) => {
            if (SKIP_RESPONSE_HEADERS.has(name)) return;

            if (Array.isArray(value)) {
                if (value.length > 0) res.setHeader(name, value);
                return;
            }
            if (typeof value === "string" || typeof value === "number") {
                res.setHeader(name, value);
            }
        });
    }

    /**
     * Builds a safe set of request headers to forward upstream.
     * Skips hop-by-hop headers and normalizes JSON `content-type` if needed.
     *
     * @param req Express request.
     * @returns Record of header name → value.
     */
    private buildRequestHeaders(req: Request): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [name, value] of Object.entries(req.headers)) {
            if (SKIP_REQUEST_HEADERS.has(name)) continue;

            if (Array.isArray(value)) {
                if (value.length > 0) result[name] = value.join(",");
                continue;
            }
            if (value !== undefined) result[name] = value;
        }

        if (!result["content-type"] && req.is("application/json")) {
            result["content-type"] = "application/json";
        }

        return result;
    }

    /**
     * Serializes the incoming request body (when appropriate) to a JSON string.
     * Only forwards bodies for methods that conventionally have one.
     *
     * @param req Express request.
     * @returns JSON string body, or `undefined` if no body should be sent.
     */
    private buildBody(req: Request): string | undefined {
        const hasBodyMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(
            req.method?.toUpperCase() ?? "GET"
        );
        if (!hasBodyMethod) return undefined;
        if (!req.body || Object.keys(req.body).length === 0) return undefined;
        return JSON.stringify(req.body);
    }

    /**
     * Persists a single row to `public.forward_log` with the given status code.
     * This method is **best-effort**: it logs a warning on failure and never throws,
     * so the forward request flow is not impacted by transient DB issues.
     *
     * @param statusCode Upstream status code to store (e.g., 200, 502).
     */
    private async persistLogEntry(
        statusCode: number,
        targetPodName: string = ForwardService.DEFAULT_TARGET_POD_NAME
    ): Promise<void> {
        const entry: ForwardLogEntry = {
            id: randomUUID(),
            logDate: new Date(),
            podName: this.podName,
            targetPodName,
            httpStatus: statusCode,
        };

        try {
            await this.db.insert(forwardLog).values({
                id: entry.id,
                logDate: entry.logDate,
                podName: entry.podName,
                targetPodName: entry.targetPodName,
                httpStatus: entry.httpStatus,
            });
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            // Keep this non-fatal for the request flow
            logger.warn(`Failed to write forward log entry: ${err.message}`);
        }
    }

    private extractTargetPodName(
        headers: Dispatcher.ResponseData["headers"],
        body: string
    ): string {
        const rawContentType = headers["content-type"]; // Undici normalizes header names to lowercase
        const contentType = Array.isArray(rawContentType)
            ? rawContentType[0]
            : rawContentType;

        if (typeof contentType === "string" && contentType.includes("application/json")) {
            try {
                const parsed = JSON.parse(body);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    const value = (parsed as Record<string, unknown>)["pod_name"];
                    if (typeof value === "string" && value.trim().length > 0) {
                        return value;
                    }
                }
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.debug(`Failed to parse upstream body for pod name: ${err.message}`);
            }
        }

        return ForwardService.DEFAULT_TARGET_POD_NAME;
    }
}

export const SKIP_FORWARD_RESPONSE_HEADERS = SKIP_RESPONSE_HEADERS;
