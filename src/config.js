import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULTS = {
  // 下载模式
  manifest: process.env.RAIN_MANIFEST || undefined,
  output: process.env.RAIN_OUTPUT || 'downloads',
  concurrency: parseInt(process.env.RAIN_CONCURRENCY, 10) || 3,
  retry: parseInt(process.env.RAIN_RETRY, 10) || 3,
  force: false,
  json: false,
  course: process.env.RAIN_COURSE || undefined,
  cookies: process.env.RAIN_COOKIES || undefined,

  // 总结模式
  summarize: false,
  courseDir: process.env.RAIN_COURSE_DIR || undefined,
  model: process.env.RAIN_MODEL || 'mimo-v2.5-pro',
  extractModel: process.env.RAIN_EXTRACT_MODEL || 'mimo-v2.5',
  apiKey: process.env.RAIN_API_KEY || 'tmp/mimo-apikey',
  forceSummary: false,
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const config = { ...DEFAULTS };

  // 子命令：summarize
  if (args[0] === 'summarize') {
    config.summarize = true;
    args.shift();
  }

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
      case '--course-dir':
        config.courseDir = args[++i];
        break;
      case '--model':
        config.model = args[++i];
        break;
      case '--extract-model':
        config.extractModel = args[++i];
        break;
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--force-summary':
        config.forceSummary = true;
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
用法: node src/index.js [summarize] [选项]

下载选项:
  -m, --manifest <path>      Manifest JSON 文件路径，使用 - 从 stdin 读取
  -o, --output <dir>         输出根目录 (默认: downloads)
  -c, --concurrency <n>      并发下载数 (默认: 3)
  -r, --retry <n>            单张图片失败重试次数 (默认: 3)
  -f, --force                强制重新下载已存在课时
  -j, --json                 输出 JSON 结果
  --course <name>            工具模式：按课程名严格匹配并自动发现
  --cookies <path>           工具模式：Cookie JSON 文件路径

总结选项:
  summarize                  进入总结模式
  --course-dir <dir>         已下载课程的目录路径
  --model <name>             总结模型 (默认: mimo-v2.5-pro)
  --extract-model <name>     图像提取模型 (默认: mimo-v2.5)
  --api-key <path|key>       MiMo API Key 文件路径或直接传入 key
  --force-summary            强制重新生成 review.md
  -h, --help                 显示帮助

环境变量:
  RAIN_MANIFEST, RAIN_OUTPUT, RAIN_CONCURRENCY, RAIN_RETRY
  RAIN_COURSE, RAIN_COOKIES
  RAIN_COURSE_DIR, RAIN_MODEL, RAIN_EXTRACT_MODEL, RAIN_API_KEY
`);
}

export function loadApiKey(config) {
  const raw = config.apiKey || DEFAULTS.apiKey;

  if (!raw) {
    throw new Error('必须提供 --api-key 参数或设置 RAIN_API_KEY 环境变量');
  }

  // 直接传入 key
  if (raw.startsWith('tp-')) {
    return raw.trim();
  }

  // 视为文件路径
  const keyPath = path.resolve(raw);
  try {
    const content = readFileSync(keyPath, 'utf-8').trim();
    if (!content.startsWith('tp-')) {
      throw new Error(`API Key 文件内容格式不正确: ${keyPath}`);
    }
    return content;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`API Key 文件不存在: ${keyPath}`);
    }
    throw err;
  }
}

export function loadConfig(argv = process.argv) {
  const config = parseArgs(argv);

  config.output = path.resolve(config.output);
  if (config.courseDir) {
    config.courseDir = path.resolve(config.courseDir);
  }

  if (config.concurrency < 1) config.concurrency = 1;
  if (config.retry < 0) config.retry = 0;

  // 总结模式校验
  if (config.summarize) {
    if (!config.courseDir) {
      throw new Error('总结模式必须提供 --course-dir 参数或 RAIN_COURSE_DIR 环境变量');
    }
    return config;
  }

  // 下载模式校验
  const hasManifest = Boolean(config.manifest);
  const hasToolMode = Boolean(config.course);

  if (!hasManifest && !hasToolMode) {
    throw new Error('必须提供 --manifest 参数或 --course 参数（或对应环境变量），或使用 summarize 子命令');
  }

  if (hasToolMode && !config.cookies) {
    throw new Error('工具模式 (--course) 必须提供 --cookies 参数或 RAIN_COOKIES 环境变量');
  }

  return config;
}

export { DEFAULTS };
