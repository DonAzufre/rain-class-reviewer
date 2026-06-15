import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

export async function downloadImage(url, destPath, options = {}) {
  const { cookie, headers = {}, retry = 3 } = options;

  await mkdir(path.dirname(destPath), { recursive: true });

  const requestHeaders = {
    ...headers,
    Cookie: cookie,
    'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Referer: headers.Referer || 'https://changjiang.yuketang.cn/',
  };

  let lastError;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const response = await fetch(url, {
        headers: requestHeaders,
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const fileStream = createWriteStream(destPath);
      await pipeline(response.body, fileStream);

      return { success: true, path: destPath };
    } catch (err) {
      lastError = err;
      if (attempt < retry) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError.message,
    url,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = [];
  const workerCount = Math.min(concurrency, tasks.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
