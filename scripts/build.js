#!/usr/bin/env node
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const skillRoot = path.dirname(path.dirname(__filename));
const outDir = path.join(skillRoot, 'dist');
const outFile = path.join(outDir, 'cli.cjs');

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(skillRoot, 'src', 'index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: outFile,
  // 不标记任何依赖为 external，确保 openai 等全部打包进单文件
  external: [],
  // Node 内置模块不会被真正打包，仅保留 require
  conditions: ['node'],
  logLevel: 'info',
});

console.log(`Bundle written to ${outFile}`);
