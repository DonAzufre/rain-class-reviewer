import { readdir, readFile, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { summarizeNotes } from './llm.js';

const EXTRACTED_DIR = 'extracted';
const REVIEW_FILE = 'review.md';

export async function findExtractedNotes(courseDir, lessonPrefix = '') {
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
          const source = note._meta?.source || '';

          if (lessonPrefix && !source.startsWith(lessonPrefix)) {
            continue;
          }

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
  lessonDir,
  model = 'mimo-v2.5-pro',
  force = false,
}) {
  let reviewPath;
  let lessonPrefix = '';

  if (lessonDir) {
    const resolvedLesson = path.resolve(lessonDir);
    const resolvedCourse = path.resolve(courseDir);

    if (!resolvedLesson.startsWith(resolvedCourse + path.sep) && resolvedLesson !== resolvedCourse) {
      throw new Error(`课时目录 ${lessonDir} 不在课程目录 ${courseDir} 下`);
    }

    lessonPrefix = path.relative(resolvedCourse, resolvedLesson).replace(/\\/g, '/');
    reviewPath = path.join(resolvedLesson, REVIEW_FILE);
  } else {
    reviewPath = path.join(courseDir, REVIEW_FILE);
  }

  if (!force) {
    try {
      await access(reviewPath);
      return { reviewPath, skipped: true };
    } catch {
      // 不存在则继续生成
    }
  }

  const notes = await findExtractedNotes(courseDir, lessonPrefix);
  if (notes.length === 0) {
    const location = lessonPrefix
      ? `${courseDir}/extracted/${lessonPrefix}`
      : `${courseDir}/extracted/`;
    throw new Error(`未在 ${location} 下找到提取笔记，请先执行提取阶段`);
  }

  const markdown = await summarizeNotes(client, model, notes);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, markdown, 'utf-8');

  return { reviewPath, skipped: false, noteCount: notes.length };
}
