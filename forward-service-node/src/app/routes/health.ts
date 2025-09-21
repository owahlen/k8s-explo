import type {Request, Response} from "express";
import logger from "@/infra/logger.js";

export const healthRoute = async (_req: Request, res: Response) => {
    const healthInfo = {
        status: "ok",
        uptime: process.uptime(), // seconds the process has been running
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(), // rss, heapTotal, heapUsed, external, etc.
    };
    logger.debug(`Health check response: ${JSON.stringify(healthInfo, null, 2)}`);
    res.status(200).json(healthInfo);
}
