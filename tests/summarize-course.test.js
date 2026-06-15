import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findExtractedNotes, summarizeCourse } from '../src/summarize-course.js';

describe('summarize-course', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rain-summarize-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should find extracted notes', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    writeFileSync(path.join(tempDir, 'extracted', 'lesson1', '001.json'), JSON.stringify({
      title: 'a',
      _meta: { source: 'lesson1/001.jpg' },
    }));

    const notes = await findExtractedNotes(tempDir);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, 'a');
  });

  it('should filter extracted notes by lesson prefix', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    mkdirSync(path.join(tempDir, 'extracted', 'lesson2'), { recursive: true });
    writeFileSync(path.join(tempDir, 'extracted', 'lesson1', '001.json'), JSON.stringify({
      title: 'lesson1',
      _meta: { source: 'lesson1/001.jpg' },
    }));
    writeFileSync(path.join(tempDir, 'extracted', 'lesson2', '001.json'), JSON.stringify({
      title: 'lesson2',
      _meta: { source: 'lesson2/001.jpg' },
    }));

    const notes = await findExtractedNotes(tempDir, 'lesson1');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, 'lesson1');
  });

  it('should generate review markdown', async () => {
    mkdirSync(path.join(tempDir, 'extracted', 'lesson1'), { recursive: true });
    writeFileSync(path.join(tempDir, 'extracted', 'lesson1', '001.json'), JSON.stringify({
      title: 'a',
      _meta: { source: 'lesson1/001.jpg' },
    }));

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
    writeFileSync(path.join(tempDir, 'extracted', 'lesson1', '001.json'), JSON.stringify({
      title: 'l1',
      _meta: { source: 'lesson1/001.jpg' },
    }));
    writeFileSync(path.join(tempDir, 'extracted', 'lesson2', '001.json'), JSON.stringify({
      title: 'l2',
      _meta: { source: 'lesson2/001.jpg' },
    }));

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
    writeFileSync(path.join(tempDir, 'extracted', 'lesson1', '001.json'), JSON.stringify({ title: 'a' }));
    writeFileSync(path.join(tempDir, 'review.md'), '# existing');

    const report = await summarizeCourse({ client: null, courseDir: tempDir });
    assert.equal(report.skipped, true);
  });
});
