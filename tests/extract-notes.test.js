import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findImageFiles, extractNotesFromCourse } from '../src/extract-notes.js';

describe('extract-notes', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rain-extract-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should find all jpg images recursively', async () => {
    mkdirSync(path.join(tempDir, 'lesson1'), { recursive: true });
    mkdirSync(path.join(tempDir, 'lesson2', '001_ppt'), { recursive: true });
    writeFileSync(path.join(tempDir, 'lesson1', '001.jpg'), 'fake');
    writeFileSync(path.join(tempDir, 'lesson2', '001_ppt', '002.jpg'), 'fake');

    const images = await findImageFiles(tempDir);
    assert.equal(images.length, 2);
  });

  it('should extract notes and skip already done', async () => {
    mkdirSync(path.join(tempDir, 'lesson1'));
    writeFileSync(path.join(tempDir, 'lesson1', '001.jpg'), 'fake');

    let callCount = 0;
    const client = {
      chat: {
        completions: {
          create: async () => {
            callCount++;
            return {
              choices: [{
                message: {
                  content: JSON.stringify({ title: 'a', bullets: [], pageType: 'content' }),
                },
              }],
            };
          },
        },
      },
    };

    const report1 = await extractNotesFromCourse({
      client,
      courseDir: tempDir,
      extractModel: 'mimo-v2.5',
    });
    assert.equal(report1.success, 1);
    assert.equal(callCount, 1);

    const report2 = await extractNotesFromCourse({
      client,
      courseDir: tempDir,
      extractModel: 'mimo-v2.5',
    });
    assert.equal(report2.results[0].skipped, true);
    assert.equal(callCount, 1);
  });
});
