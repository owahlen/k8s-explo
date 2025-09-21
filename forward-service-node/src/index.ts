import { buildApp } from "./app/index.ts";

// Export the Express app directly for Vite to use.
export const viteNodeApp = buildApp();
