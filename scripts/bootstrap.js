#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const skillRoot = path.dirname(path.dirname(__filename));
const nodeModulesDir = path.join(skillRoot, 'node_modules');
const cliEntry = path.join(skillRoot, 'src', 'index.js');

function run(command, args, options = {}) {
  const isWin = process.platform === 'win32';
  const cmd = isWin && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(cmd, args, {
    cwd: skillRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  return result;
}

if (!existsSync(nodeModulesDir)) {
  console.log('[bootstrap] 首次使用，正在安装依赖...');
  const installResult = run('npm', ['install', '--omit=dev']);
  if (installResult.status !== 0) {
    console.error('[bootstrap] 依赖安装失败，请检查网络或 npm 配置。');
    process.exit(installResult.status ?? 1);
  }
}

const result = run('node', [cliEntry, ...process.argv.slice(2)]);
process.exit(result.status ?? 0);
