// Import Express dynamically so it's patched by OTel
const { default: express } = await import('express');
import { bodyMiddleware } from '@/app/middleware/body.ts';
import { requestLogger } from '@/app/middleware/request-logger.ts';
import { errorHandler } from '@/app/middleware/errors.ts';
import { healthRoute } from '@/app/routes/health.ts';
import { createForwardHandler } from '@/app/routes/forward.ts';
import { createForwardService, type ForwardService } from '@/service/index.ts';

export interface BuildAppOptions {
    forwardService?: ForwardService;
}

export const buildApp = (options: BuildAppOptions = {}) => {
    const app = express();
    const forwardService = options.forwardService ?? createForwardService();

    app.use(bodyMiddleware);
    app.use(requestLogger);
    app.get('/health', healthRoute);
    app.use(createForwardHandler(forwardService));
    app.use(errorHandler);

    return app;
};
