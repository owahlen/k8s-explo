import type { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '@/infra/logger.ts';
import { ForwardService, ForwardServiceError } from '@/service/index.ts';

const JSON_CONTENT_TYPE = 'application/json';

const extractContentType = (headers: Record<string, string | string[] | undefined>): string | undefined => {
    const raw = headers['content-type'];
    if (!raw) {
        return undefined;
    }

    return Array.isArray(raw) ? raw[0] : raw;
};

export const createForwardHandler = (service: ForwardService): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.forward(req);
            const headers = result.headers as Record<string, string | string[] | undefined>;
            const contentType = extractContentType(headers);

            service.decorateResponseHeaders(res, headers);

            if (contentType && !res.getHeader('content-type')) {
                res.setHeader('content-type', contentType);
            }

            res.status(result.statusCode);

            if (contentType?.includes(JSON_CONTENT_TYPE)) {
                res.send(result.body || 'null');
            } else {
                res.send(result.body);
            }
        } catch (error) {
            if (error instanceof ForwardServiceError) {
                const payload = error.body ?? { error: 'Bad Gateway', detail: 'Failed to reach upstream' };
                res.status(error.statusCode).json(payload);
                return;
            }

            logger.error(`Unhandled forward route error: ${(error as Error)?.message || String(error)}`);
            next(error);
        }
    };
};
