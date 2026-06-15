import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { summarizeNotes } from './llm.js';

const EXTRACTED_DIR = 'extracted';
const REVIEW_FILE = 'review.md';

export async function findExtractedNotes(courseDir) {
  const notesDir = path.join(courseDir, EXTRACTED_DIR);
  const notes = [];

  async function scan(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'state.json') {
        try {
          const raw = await readFile(fullPath, 'utf-8');
          const note = JSON.parse(raw);
          notes.push(note);
        } catch {
          // 跳过损坏的 JSON
        }
      }
    }
  }

  try {
    await scan(notesDir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  // 按 source 路径排序，保持课程原有顺序
  return notes.sort((a, b) => (a._meta?.source || '').localeCompare(b._meta?.source || ''));
}

export async function summarizeCourse({
  client,
  courseDir,
  model = 'mimo-v2.5-pro',
  force = false,
}) {
  const reviewPath = path.join(courseDir, REVIEW_FILE);

  if (!force) {
    try {
      await access(reviewPath);
      return { reviewPath, skipped: true };
    } catch {
      // 不存在则继续生成
    }
  }

  const notes = await findExtractedNotes(courseDir);
  if (notes.length === 0) {
    throw new Error(`未在 ${courseDir}/extracted/ 下找到提取笔记，请先执行提取阶段`);
  }

  const markdown = await summarizeNotes(client, model, notes);
  await writeFile(reviewPath, markdown, 'utf-8');

  return { reviewPath, skipped: false, noteCount: notes.length };
}
