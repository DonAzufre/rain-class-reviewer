#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const skillRoot = path.dirname(path.dirname(__filename));
const nodeModulesDir = path.join(skillRoot, 'node_modules');
const bundlePath = path.join(skillRoot, 'dist', 'cli.cjs');
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

function installDependencies() {
  const args = ['install', '--omit=dev', '--no-audit', '--no-fund'];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[bootstrap] 首次使用，正在安装依赖... (尝试 ${attempt}/${maxAttempts})`);
    const result = run('npm', args);
    if (result.status === 0) {
      return true;
    }
    console.warn(`[bootstrap] 依赖安装失败（尝试 ${attempt}/${maxAttempts}）。`);
  }

  console.error('[bootstrap] 依赖安装失败，请检查网络或 npm 配置，也可手动运行：npm install');
  return false;
}

// 优先使用预构建 bundle，避免在 Agent 环境里现场安装 openai 等依赖
if (existsSync(bundlePath)) {
  const result = run('node', [bundlePath, ...process.argv.slice(2)]);
  process.exit(result.status ?? 0);
}

if (!existsSync(nodeModulesDir)) {
  const ok = installDependencies();
  if (!ok) {
    process.exit(1);
  }
}

const result = run('node', [cliEntry, ...process.argv.slice(2)]);
process.exit(result.status ?? 0);
