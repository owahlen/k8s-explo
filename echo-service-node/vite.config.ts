/// <reference types="vitest" />
import {defineConfig} from 'vite';
import {VitePluginNode} from 'vite-plugin-node';

export default defineConfig({
    server: {
        // This allows Vite to start the server at a specific port.
        port: 5173
    },
    build: {
        lib: {
            // The entry file Vite will start bundling from
            entry: "src/index.ts",
            // Output format(s). "es" = standard ESM bundle
            formats: ["es"]
        }
    },
    plugins: [
        ...VitePluginNode({
            // The entry file for your application
            appPath: './src/index.ts',
            // The server adapter for Express
            adapter: 'express',
        })
    ],
    test: {
        // Vitest-specific options
        environment: 'node'
    },
});
