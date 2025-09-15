/// <reference types="vitest" />
import {defineConfig} from 'vite';
import {VitePluginNode} from 'vite-plugin-node';

export default defineConfig({
    server: {
        port: 3001
    },
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"]
        }
    },
    plugins: [
        ...VitePluginNode({
            appPath: './src/index.ts',
            adapter: 'express',
        })
    ],
    test: {
        environment: 'node'
    },
});
