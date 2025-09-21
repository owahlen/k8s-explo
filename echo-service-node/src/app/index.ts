// Import Express dynamically so it's patched by OTel
const {default: express} = await import("express");
import { bodyMiddleware } from "./middleware/body.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { errorHandler } from "./middleware/errors.ts";
import { healthRoute } from "./routes/health.ts";
import { echoRoute } from "./routes/echo.ts";

export const buildApp = () => {
    const app = express();
    app.use(bodyMiddleware);
    app.use(requestLogger);
    app.get("/health", healthRoute);
    app.use(echoRoute);             // catch-all proxy
    app.use(errorHandler);             // last
    return app;
}
