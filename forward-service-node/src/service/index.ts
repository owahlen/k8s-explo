import { env } from '@/config/env.ts';
import { createForwardLogRepository } from '@/repository/index.ts';
import { ForwardService } from '@/service/forward-service.ts';

export const createForwardService = (): ForwardService => {
    const repository = createForwardLogRepository();
    return new ForwardService({
        repository,
        baseUrl: env.forwardBaseURL,
        podName: env.podName,
        requestTimeout: env.requestTimeout,
    });
};

export { ForwardService, ForwardServiceError } from '@/service/forward-service.ts';
