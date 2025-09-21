import type { Request, Response, NextFunction } from "express";
import logger from "@/infra/logger.ts";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    logger.error(err?.stack || err?.message || String(err));
    res.status(502).json({ error: "Bad Gateway", detail: "Upstream failure" });
}
