import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { sanitizeDirName, getLessonDir, padNumber } from '../src/organize.js';

describe('organize', () => {
  it('should sanitize directory name', () => {
    assert.equal(sanitizeDirName('a/b:c?d'), 'a_b_c_d');
    assert.equal(sanitizeDirName('  hello  world  '), 'hello world');
  });

  it('should pad numbers', () => {
    assert.equal(padNumber(1, 3), '001');
    assert.equal(padNumber(10, 3), '010');
  });

  it('should generate lesson directory path', () => {
    const lesson = { lessonId: 'l1', date: '2025-01-01', title: 'Lesson 1' };
    const dir = getLessonDir('/output', lesson);
    assert.ok(dir.includes('2025-01-01_l1_Lesson 1'));
  });
});
