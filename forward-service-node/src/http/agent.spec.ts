import {describe, it, expect, vi, beforeEach} from "vitest";

// --- shared mocks ---
const closeMock = vi.fn().mockResolvedValue(undefined);
const AgentMock = vi.fn(() => ({close: closeMock}));
const setGlobalDispatcherMock = vi.fn();

// Mock logger early
vi.mock("@/infra/logger.ts", () => ({
    default: {warn: vi.fn()},
}));

// Helper to (re)load the SUT with fresh mocks
async function loadSutWithEnv(envAgentOpts: Record<string, any>) {
    vi.resetModules();

    // Mock env BEFORE importing SUT
    vi.doMock("@/config/env.ts", () => ({
        env: {agent: envAgentOpts},
    }));

    // Mock undici: BOTH default and named exports
    vi.doMock("undici", async () => {
        const actual: any = await vi.importActual("undici"); // keep other types if you like
        return {
            ...actual,
            default: {
                // the SUT reads these from the default import
                Agent: AgentMock,
                setGlobalDispatcher: setGlobalDispatcherMock,
            },
            // also provide named in case SUT changes later
            Agent: AgentMock,
            setGlobalDispatcher: setGlobalDispatcherMock,
        };
    });

    return await import("./agent.ts"); // <-- SUT path
}

describe("http/agent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates an Agent with env.agent options and sets it as global dispatcher", async () => {
        await loadSutWithEnv({connections: 42, keepAliveTimeout: 1234});

        expect(AgentMock).toHaveBeenCalledTimes(1);
        expect(AgentMock).toHaveBeenCalledWith({connections: 42, keepAliveTimeout: 1234});
        expect(setGlobalDispatcherMock).toHaveBeenCalledTimes(1);
        // ensure it was called with the instance returned by AgentMock
        const agentInstance = (AgentMock.mock.results[0] as any).value;
        expect(setGlobalDispatcherMock).toHaveBeenCalledWith(agentInstance);
    });

    it("closeAgent() calls agent.close()", async () => {
        const mod = await loadSutWithEnv({});
        await mod.closeAgent();
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it("closeAgent() logs a warning when close rejects", async () => {
        const {default: logger} = await import("@/infra/logger.ts");
        closeMock.mockRejectedValueOnce(new Error("boom"));

        const mod = await loadSutWithEnv({});
        await mod.closeAgent();

        expect((logger as any).warn).toHaveBeenCalledTimes(1);
        expect((logger as any).warn.mock.calls[0][0]).toMatch(/Error closing shared agent: Error: boom/);
    });
});
