import { ForwardService } from '@/service/forward-service.ts';

export const createForwardService = (): ForwardService => {
    return new ForwardService();
};

export { ForwardService, ForwardServiceError } from '@/service/forward-service.ts';
