import type { Request, Response } from "express";
import Undici from "undici";
import request = Undici.request;
import { env } from "@/config/env.ts";
import logger from "@/infra/logger.ts";

export const forwardRoute = async (req: Request, res: Response) => {
    const upstreamBase = env.forwardBaseURL;
    const targetUrl = new URL(req.originalUrl, upstreamBase).toString();

    logger.http(`Forwarding ${req.method} ${req.originalUrl} -> ${targetUrl}`);

    const hasBodyMethod = ["POST","PUT","PATCH","DELETE"].includes(req.method.toUpperCase());
    const body = hasBodyMethod && req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined;

    try {
        const { statusCode, body: upstreamBody } = await request(targetUrl, {
            method: req.method,
            headers: { "content-type": "application/json" },
            body,
            // uses global Agent
        });

        const text = await upstreamBody.text();
        let data: any;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }

        logger.debug(`Upstream ${statusCode}: ${text?.slice(0, 512)}`);
        res.status(statusCode).json(data);
    } catch (e: any) {
        logger.error(`Forward error: ${e?.stack || e?.message || String(e)}`);
        res.status(502).json({ error: "Bad Gateway", detail: "Failed to reach upstream" });
    }
}
