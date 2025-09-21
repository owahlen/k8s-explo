import type {Request, Response, NextFunction} from "express";
import logger from "@/infra/logger.ts";

export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
    logger.http(`${req.method} ${req.originalUrl}`);
    next();
}
