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

const AGENT_DIRS = new Set(['.claude', '.opencode', '.agents', '.codex', '.cursor']);
const PATH_OPTIONS = new Set([
  '--manifest', '-m',
  '--output', '-o',
  '--course-dir',
  '--lesson-dir',
  '--cookies',
  '--api-key',
]);

function deriveProjectRoot(skillRoot) {
  const parts = skillRoot.split(path.sep);
  for (let i = parts.length - 3; i >= 0; i--) {
    if (AGENT_DIRS.has(parts[i]) && parts[i + 1] === 'skills') {
      return parts.slice(0, i).join(path.sep) || path.sep;
    }
  }
  return null;
}

function isProjectLike(dir) {
  return ['.git', 'package.json', '.claudeignore', 'README.md'].some((file) =>
    existsSync(path.join(dir, file))
  );
}

function getProjectRoot() {
  const cwd = process.cwd();
  const candidate = deriveProjectRoot(skillRoot);

  if (candidate && isProjectLike(candidate)) {
    return candidate;
  }

  // 如果推导不出项目根目录，则使用调用时的当前目录
  return cwd;
}

function run(command, args, options = {}) {
  const isWin = process.platform === 'win32';
  const cmd = isWin && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(cmd, args, {
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
    const result = run('npm', args, { cwd: skillRoot });
    if (result.status === 0) {
      return true;
    }
    console.warn(`[bootstrap] 依赖安装失败（尝试 ${attempt}/${maxAttempts}）。`);
  }

  console.error('[bootstrap] 依赖安装失败，请检查网络或 npm 配置，也可手动运行：npm install');
  return false;
}

function resolveCliArgs(args, projectRoot) {
  const resolved = [];
  let hasOutput = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    resolved.push(arg);

    if (!PATH_OPTIONS.has(arg) || i + 1 >= args.length) {
      continue;
    }

    let value = args[++i];

    if (arg === '--manifest' || arg === '-m') {
      if (value !== '-') {
        value = path.resolve(projectRoot, value);
      }
    } else if (arg === '--cookies') {
      if (value !== '-' && !value.startsWith('{')) {
        value = path.resolve(projectRoot, value);
      }
    } else if (arg === '--api-key') {
      if (!value.startsWith('tp-')) {
        value = path.resolve(projectRoot, value);
      }
    } else {
      // --output / -o / --course-dir / --lesson-dir
      value = path.resolve(projectRoot, value);
    }

    if (arg === '--output' || arg === '-o') {
      hasOutput = true;
    }

    resolved.push(value);
  }

  // 未指定输出目录时，默认使用项目根目录下的 rain-class-reviewer-downloads
  if (!hasOutput && !process.env.RAIN_OUTPUT) {
    resolved.push('--output', path.join(projectRoot, 'rain-class-reviewer-downloads'));
  }

  return resolved;
}

const projectRoot = getProjectRoot();
const rawArgs = process.argv.slice(2);
const resolvedArgs = resolveCliArgs(rawArgs, projectRoot);

// 优先使用预构建 bundle，避免在 Agent 环境里现场安装 openai 等依赖
if (existsSync(bundlePath)) {
  const result = run('node', [bundlePath, ...resolvedArgs], { cwd: projectRoot });
  process.exit(result.status ?? 0);
}

if (!existsSync(nodeModulesDir)) {
  const ok = installDependencies();
  if (!ok) {
    process.exit(1);
  }
}

const result = run('node', [cliEntry, ...resolvedArgs], { cwd: projectRoot });
process.exit(result.status ?? 0);
