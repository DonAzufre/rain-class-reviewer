import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULTS = {
  manifest: process.env.RAIN_MANIFEST || undefined,
  output: process.env.RAIN_OUTPUT || 'downloads',
  concurrency: parseInt(process.env.RAIN_CONCURRENCY, 10) || 3,
  retry: parseInt(process.env.RAIN_RETRY, 10) || 3,
  force: false,
  json: false,
  course: process.env.RAIN_COURSE || undefined,
  cookies: process.env.RAIN_COOKIES || undefined,
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = { ...DEFAULTS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--manifest':
      case '-m':
        config.manifest = args[++i];
        break;
      case '--output':
      case '-o':
        config.output = args[++i];
        break;
      case '--concurrency':
      case '-c':
        config.concurrency = parseInt(args[++i], 10) || DEFAULTS.concurrency;
        break;
      case '--retry':
      case '-r':
        config.retry = parseInt(args[++i], 10) || DEFAULTS.retry;
        break;
      case '--force':
      case '-f':
        config.force = true;
        break;
      case '--json':
      case '-j':
        config.json = true;
        break;
      case '--course':
        config.course = args[++i];
        break;
      case '--cookies':
        config.cookies = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`未知参数: ${arg}`);
        }
        break;
    }
  }

  return config;
}

function showHelp() {
  console.log(`
用法: node src/index.js [选项]

选项:
  -m, --manifest <path>      Manifest JSON 文件路径，使用 - 从 stdin 读取
  -o, --output <dir>         输出根目录 (默认: 当前目录)
  -c, --concurrency <n>      并发下载数 (默认: 3)
  -r, --retry <n>            单张图片失败重试次数 (默认: 3)
  -f, --force                强制重新下载已存在课时
  -j, --json                 输出 JSON 结果
  --course <name>            工具模式：按课程名严格匹配并自动发现
  --cookies <path>           工具模式：Cookie JSON 文件路径
  -h, --help                 显示帮助

环境变量:
  RAIN_MANIFEST              Manifest 路径
  RAIN_OUTPUT                输出根目录
  RAIN_CONCURRENCY           并发数
  RAIN_RETRY                 重试次数
  RAIN_COURSE                工具模式课程名
  RAIN_COOKIES               工具模式 Cookie JSON 文件路径

工具模式示例:
  node src/index.js --course "工程伦理概论" --cookies ./cookies.json
`);
}

export function loadConfig(argv = process.argv) {
  const config = parseArgs(argv);

  const hasManifest = Boolean(config.manifest);
  const hasToolMode = Boolean(config.course);

  if (!hasManifest && !hasToolMode) {
    throw new Error('必须提供 --manifest 参数或 --course 参数（或对应环境变量）');
  }

  if (hasToolMode && !config.cookies) {
    throw new Error('工具模式 (--course) 必须提供 --cookies 参数或 RAIN_COOKIES 环境变量');
  }

  config.output = path.resolve(config.output);

  if (config.concurrency < 1) config.concurrency = 1;
  if (config.retry < 0) config.retry = 0;

  return config;
}

export { DEFAULTS };
