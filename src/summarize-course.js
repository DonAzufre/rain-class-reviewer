import { readdir, readFile, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { summarizeNotes, callWithRetry } from './llm.js';

const EXTRACTED_DIR = 'extracted';
const REVIEW_FILE = 'review.md';
const DEFAULT_CHUNK_SIZE = 60;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, content: raw };

  const meta = {};
  const lines = match[1].split('\n');
  let key = null;
  for (const line of lines) {
    const simple = line.match(/^(\w+):\s*(.*)$/);
    if (simple) {
      key = simple[1];
      let value = simple[2];
      try {
        value = JSON.parse(value);
      } catch {
        // 保持字符串
      }
      meta[key] = value;
      continue;
    }

    if (key && line.startsWith('  ')) {
      const continued = line.slice(2);
      meta[key] = meta[key] ? `${meta[key]}\n${continued}` : continued;
    }
  }

  return { meta, content: raw.slice(match[0].length).trim() };
}

export async function findExtractedNotes(courseDir, lessonPrefix = '') {
  const notesDir = path.join(courseDir, EXTRACTED_DIR);
  const notes = [];

  async function scan(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = await readFile(fullPath, 'utf-8');
          const { meta, content } = parseFrontmatter(raw);
          const source = meta.source || imagePathToKey(courseDir, fullPath).replace(/\.md$/, '.jpg');

          if (lessonPrefix && !source.startsWith(lessonPrefix)) {
            continue;
          }

          if (meta.status === 'error') {
            continue;
          }

          if (!content.trim()) {
            continue;
          }

          notes.push({ source, content });
        } catch {
          // 跳过损坏的文件
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

  return notes.sort((a, b) => a.source.localeCompare(b.source));
}

function imagePathToKey(courseDir, filePath) {
  return path.relative(courseDir, filePath).replace(/\\/g, '/');
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
    throw new Error(`未在 ${location} 下找到有效 Markdown 笔记，请先执行提取阶段`);
  }

  const markdown = await summarizeNotesInChunks(client, model, notes, DEFAULT_CHUNK_SIZE);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, markdown, 'utf-8');

  return { reviewPath, skipped: false, noteCount: notes.length };
}

async function summarizeNotesInChunks(client, model, notes, chunkSize) {
  if (notes.length <= chunkSize) {
    return summarizeNotes(client, model, notes);
  }

  console.log(`笔记共 ${notes.length} 页，超过 ${chunkSize} 页，将分块总结...`);

  const chunks = [];
  for (let i = 0; i < notes.length; i += chunkSize) {
    chunks.push(notes.slice(i, i + chunkSize));
  }

  const intermediateSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  总结第 ${i + 1}/${chunks.length} 块 (${chunks[i].length} 页)...`);
    const summary = await summarizeNotes(client, model, chunks[i]);
    intermediateSummaries.push(summary);
  }

  console.log('  合并各块摘要...');
  return mergeSummaries(client, model, intermediateSummaries);
}

async function mergeSummaries(client, model, summaries) {
  const combined = summaries.join('\n\n---\n\n');
  const messages = [
    {
      role: 'system',
      content: `你是一名课程复习大纲整理专家。下面是课程各部分的 Markdown 中间摘要，请整合为一份完整、连贯、去重、信息密度高的 Markdown 复习大纲。

要求：
1. 按主题/章节组织层级结构。
2. 合并重复概念，保留不同角度的解释和示例。
3. 突出定义、定理、算法、例题、易错点。
4. 保留关键细节，不要过度压缩。
5. 使用中文。
6. 输出纯 Markdown，不要代码块包裹。`,
    },
    {
      role: 'user',
      content: `以下是各块中间摘要：\n\n${combined}`,
    },
  ];

  const response = await callWithRetry(() => client.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('合并总结模型返回空内容');
  }

  return content;
}
