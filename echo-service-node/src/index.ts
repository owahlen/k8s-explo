import express, {Request, Response} from 'express';
import logger from './logger.ts';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {recordRequest, startMetrics} from "./metrics.ts";

const app = express();
const port = process.env.PORT || 3000;

startMetrics();

// Middleware to parse JSON bodies
app.use(express.json());

// Health endpoint for k8s/minikube
app.get('/health', (req: Request, res: Response) => {
    const healthInfo = {
        status: 'ok',
        uptime: process.uptime(), // seconds the process has been running
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage(), // rss, heapTotal, heapUsed, external, etc.
    };

    logger.debug(`Health check response: ${JSON.stringify(healthInfo, null, 2)}`);
    res.status(200).json(healthInfo);
});

// Main echo-server endpoint
app.all('/{*path}', (req: Request, res: Response) => {
    const start = Date.now();
    logger.http(`Received ${req.method} request on ${req.originalUrl}`);

    // Construct the response body
    const response = {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body || null,
        query: req.query || null,
    };

    logger.debug(`Sending response: ${JSON.stringify(response, null, 2)}`)

    res.status(200).json(response);
    recordRequest(req.path, Date.now()-start);
});

// Export the Express app directly for Vite to use.
export const viteNodeApp = app;

const isRunDirect =
    (typeof require !== "undefined" && typeof module !== "undefined")
        ? require.main === module // CJS build
        : (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url));

if (isRunDirect) {
    app.listen(port, () => {
        logger.info(`Echo service is listening on http://localhost:${port}`);
    });
}
