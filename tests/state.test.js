import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isLessonDownloaded } from '../src/state.js';

describe('state', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rain-state-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should detect downloaded lesson with matching presentations', () => {
    writeFileSync(path.join(tempDir, 'meta.json'), JSON.stringify({
      totalImages: 3,
      downloadedCount: 3,
      failedCount: 0,
    }));

    const presentations = [
      { presentationId: 'p1', images: ['a', 'b'] },
      { presentationId: 'p2', images: ['c'] },
    ];

    assert.equal(isLessonDownloaded(tempDir, presentations), true);
  });

  it('should detect incomplete download', () => {
    writeFileSync(path.join(tempDir, 'meta.json'), JSON.stringify({
      totalImages: 2,
      downloadedCount: 1,
      failedCount: 1,
    }));

    assert.equal(isLessonDownloaded(tempDir, [{ presentationId: 'p1', images: ['a', 'b'] }]), false);
  });

  it('should handle legacy imageCount field', () => {
    writeFileSync(path.join(tempDir, 'meta.json'), JSON.stringify({
      imageCount: 2,
      downloadedCount: 2,
      failedCount: 0,
    }));

    assert.equal(isLessonDownloaded(tempDir, 2), true);
  });
});
