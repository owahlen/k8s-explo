import type { Request, Response } from "express";
import logger from "@/infra/logger.ts";

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

    logger.debug(`Sending response: ${JSON.stringify(response, null, 2)}`);
    res.status(200).json(response);
}
