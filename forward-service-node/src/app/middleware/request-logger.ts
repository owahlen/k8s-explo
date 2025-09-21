import type { Request, Response, NextFunction } from "express";
import logger from "@/infra/logger.js";

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
    logger.http(`${req.method} ${req.originalUrl}`);
    next();
}
