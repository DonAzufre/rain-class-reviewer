import { readdir, readFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { extractFromImage } from './llm.js';
import { runWithConcurrency } from './download.js';

const STATE_FILE = 'state.json';
const EXTRACTED_DIR = 'extracted';

function imagePathToKey(courseDir, imagePath) {
  return path.relative(courseDir, imagePath).replace(/\\/g, '/');
}

export async function findImageFiles(rootDir) {
  const images = [];

  async function scan(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && /\.(jpg|jpeg)$/i.test(entry.name)) {
        images.push(fullPath);
      }
    }
  }

  await scan(rootDir);
  return images.sort();
}

export async function readState(courseDir) {
  const statePath = path.join(courseDir, EXTRACTED_DIR, STATE_FILE);
  try {
    const raw = await readFile(statePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function writeState(courseDir, state) {
  const statePath = path.join(courseDir, EXTRACTED_DIR, STATE_FILE);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function outputPathForImage(courseDir, imagePath) {
  const relKey = imagePathToKey(courseDir, imagePath);
  const baseName = path.basename(imagePath, path.extname(imagePath));
  const dirName = path.dirname(relKey);
  return path.join(courseDir, EXTRACTED_DIR, dirName, `${baseName}.json`);
}

export async function extractNotesFromCourse({
  client,
  courseDir,
  lessonDir,
  extractModel = 'mimo-v2.5',
  force = false,
  concurrency = 2,
  onProgress,
}) {
  const scanDir = path.resolve(lessonDir || courseDir);
  const allImages = await findImageFiles(scanDir);

  // 如果指定了 lessonDir，只保留该目录下的图片
  let images = allImages;
  if (lessonDir) {
    const resolvedLesson = path.resolve(lessonDir);
    images = allImages.filter((p) => p.startsWith(resolvedLesson + path.sep));
  }

  const state = await readState(courseDir);
  const results = [];

  const tasks = images.map((imagePath, i) => async () => {
    const relKey = imagePathToKey(courseDir, imagePath);
    const outputPath = outputPathForImage(courseDir, imagePath);

    if (!force && state[relKey]?.status === 'done') {
      try {
        await access(outputPath);
        results[i] = { imagePath, relKey, outputPath, skipped: true };
        if (onProgress) {
          onProgress({ current: i + 1, total: images.length, relKey, skipped: true });
        }
        return;
      } catch {
        // 文件缺失，重新提取
      }
    }

    try {
      const imageBuffer = await readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      const note = await extractFromImage(client, extractModel, base64, 'image/jpeg');

      // 补充元数据
      note._meta = {
        source: relKey,
        extractedAt: new Date().toISOString(),
        model: extractModel,
      };

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(note, null, 2), 'utf-8');

      state[relKey] = { status: 'done', outputPath: imagePathToKey(courseDir, outputPath), updatedAt: new Date().toISOString() };
      results[i] = { imagePath, relKey, outputPath, skipped: false };
    } catch (err) {
      state[relKey] = { status: 'error', error: err.message, updatedAt: new Date().toISOString() };
      results[i] = { imagePath, relKey, outputPath, skipped: false, error: err.message };
    }

    await writeState(courseDir, state);

    if (onProgress) {
      onProgress({ current: i + 1, total: images.length, relKey, skipped: false, error: results[i].error });
    }
  });

  await runWithConcurrency(tasks, concurrency);

  return {
    total: images.length,
    success: results.filter((r) => r && !r.error).length,
    failed: results.filter((r) => r && r.error).length,
    results: results.filter(Boolean),
  };
}
