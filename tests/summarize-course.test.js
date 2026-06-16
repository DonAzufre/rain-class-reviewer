import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findExtractedNotes, summarizeCourse } from '../src/summarize-course.js';

function createNoteMd(source, content) {
  return `---
source: "${source}"
extractedAt: "2026-06-15T00:00:00.000Z"
model: "mimo-v2.5"
status: "done"
---

${content}`;
}

describe('summarize-course', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rain-summarize-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should find extracted markdown notes', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson1', '001.md'),
      createNoteMd('lesson1/001.jpg', '# 笔记 a\n\n## 详细总结\n内容。')
    );

    const notes = await findExtractedNotes(tempDir);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].source, 'lesson1/001.jpg');
    assert.ok(notes[0].content.includes('# 笔记 a'));
  });

  it('should filter extracted notes by lesson prefix', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    mkdirSync(path.join(tempDir, 'extracted', 'lesson2'), { recursive: true });
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson1', '001.md'),
      createNoteMd('lesson1/001.jpg', '# lesson1')
    );
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson2', '001.md'),
      createNoteMd('lesson2/001.jpg', '# lesson2')
    );

    const notes = await findExtractedNotes(tempDir, 'lesson1');
    assert.equal(notes.length, 1);
    assert.ok(notes[0].content.includes('# lesson1'));
  });

  it('should skip error notes', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson1', '001.md'),
      '---\nsource: "lesson1/001.jpg"\nstatus: "error"\nerror: "fail"\n---\n\n'
    );

    const notes = await findExtractedNotes(tempDir);
    assert.equal(notes.length, 0);
  });

  it('should generate review markdown', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson1', '001.md'),
      createNoteMd('lesson1/001.jpg', '# 笔记 a\n\n## 详细总结\n内容。')
    );

    const client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: '# Review\n- a' } }],
          }),
        },
      },
    };

    const report = await summarizeCourse({ client, courseDir: tempDir, model: 'mimo-v2.5-pro' });
    assert.equal(report.skipped, false);
    assert.equal(report.noteCount, 1);
  });

  it('should generate review for single lesson dir', async () => {
    const lessonDir = path.join(tempDir, 'lesson1');
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    mkdirSync(path.join(tempDir, 'extracted', 'lesson2'), { recursive: true });
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson1', '001.md'),
      createNoteMd('lesson1/001.jpg', '# l1')
    );
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson2', '001.md'),
      createNoteMd('lesson2/001.jpg', '# l2')
    );

    const client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: '# Lesson Review' } }],
          }),
        },
      },
    };

    const report = await summarizeCourse({ client, courseDir: tempDir, lessonDir, model: 'mimo-v2.5-pro' });
    assert.equal(report.skipped, false);
    assert.equal(report.noteCount, 1);
    assert.ok(report.reviewPath.includes('lesson1'));
  });

  it('should skip existing review unless forced', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    writeFileSync(
      path.join(tempDir, 'extracted', 'lesson1', '001.md'),
      createNoteMd('lesson1/001.jpg', '# a')
    );
    writeFileSync(path.join(tempDir, 'review.md'), '# existing');

    const report = await summarizeCourse({ client: null, courseDir: tempDir });
    assert.equal(report.skipped, true);
  });
});
