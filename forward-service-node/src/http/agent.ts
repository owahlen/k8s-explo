import Undici from "undici";
import {env} from "@/config/env.ts";
import logger from "@/infra/logger.ts";
import Agent = Undici.Agent;
import setGlobalDispatcher = Undici.setGlobalDispatcher;

const agent = new Agent(env.agent);

setGlobalDispatcher(agent);

export const closeAgent = async (): Promise<void> => {
    agent.close().catch((err: any) =>
        logger.warn(`Error closing shared agent: ${err}`)
    );
};
