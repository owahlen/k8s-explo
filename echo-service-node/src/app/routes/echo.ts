import type { Request, Response } from "express";
import logger from "@/infra/logger.ts";

const parseNonNegativeNumber = (value: unknown): number | null => {
    const parse = (input: string): number | null => {
        const trimmed = input.trim();
        if (trimmed === "") {
            return null;
        }
        const parsed = Number(trimmed);
        if (Number.isNaN(parsed) || parsed < 0) {
            return null;
        }
        return parsed;
    };

    if (typeof value === "string") {
        return parse(value);
    }

    if (Array.isArray(value)) {
        for (const entry of value) {
            if (typeof entry === "string") {
                const parsed = parse(entry);
                if (parsed !== null) {
                    return parsed;
                }
            }
        }
    }

    return null;
};

const determineLatency = (req: Request): number | null => {
    const fixedLatency = parseNonNegativeNumber(req.query.latency);
    if (fixedLatency !== null) {
        return fixedLatency;
    }

    const maxLatency = parseNonNegativeNumber(req.query.latency_max);
    if (maxLatency === null) {
        return null;
    }

    const minLatency = parseNonNegativeNumber(req.query.latency_min) ?? 0;
    if (minLatency > maxLatency) {
        return null;
    }

    if (minLatency === maxLatency) {
        return minLatency;
    }

    const range = maxLatency - minLatency;
    return minLatency + Math.random() * range;
};

const delay = (ms: number): Promise<void> => {
    if (ms <= 0) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

export const echoRoute = async (req: Request, res: Response) => {
    logger.http(`Received ${req.method} ${req.originalUrl}`);

    const response = {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body ?? null,
        query: req.query ?? null,
        pod_name: process.env.POD_NAME ?? null,
    };

    const latency = determineLatency(req);
    if (latency !== null) {
        await delay(latency);
    }

    logger.debug(`Sending response: ${JSON.stringify(response, null, 2)}`);
    res.status(200).json(response);
}
