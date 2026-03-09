import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['bin/docpilot.ts', 'src/index.ts'],
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node18',
    banner: {
        js: '#!/usr/bin/env node',
    },
});
