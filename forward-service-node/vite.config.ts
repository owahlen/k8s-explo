/// <reference types="vitest" />
import {defineConfig} from 'vite';
import {VitePluginNode} from 'vite-plugin-node';
import * as path from "node:path";

export default defineConfig(({command}) => {
    const plugins = [];

    if (command === 'serve') {
        plugins.push(
            ...VitePluginNode({
                adapter: 'express',
                appPath: './src/index.ts',
            })
        );
    }

    return {
        plugins,
        server: {
            port: 5174
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
            }
        },
        build: {
            target: 'node22',
            ssr: true,
            rollupOptions: {
                input: "./src/server.ts",
                output: {
                    format: "es",
                    entryFileNames: "[name].js",
                }
            },
        },
        test: {
            environment: 'node'
        },
    };
});
