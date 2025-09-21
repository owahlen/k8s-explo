// Import Express dynamically so it's patched by OTel
const {default: express} = await import("express");
export const bodyMiddleware = express.json();
