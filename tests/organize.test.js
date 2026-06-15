import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { sanitizeDirName, getLessonDir, getPresentationDir, padNumber } from '../src/organize.js';

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

  it('should not create subdir for single-presentation lesson', () => {
    const lesson = {
      lessonId: 'l1',
      date: '2025-01-01',
      title: 'Lesson 1',
      presentations: [{ presentationId: 'p1', title: 'A', images: [] }],
    };
    const lessonDir = getLessonDir('/output', lesson);
    const pptDir = getPresentationDir(lessonDir, lesson, lesson.presentations[0], 0);
    assert.equal(pptDir, lessonDir);
  });

  it('should create subdir for multi-presentation lesson', () => {
    const lesson = {
      lessonId: 'l1',
      date: '2025-01-01',
      title: 'Lesson 1',
      presentations: [
        { presentationId: 'p1', title: 'A', images: [] },
        { presentationId: 'p2', title: 'B', images: [] },
      ],
    };
    const lessonDir = getLessonDir('/output', lesson);
    const pptDir = getPresentationDir(lessonDir, lesson, lesson.presentations[1], 1);
    assert.ok(pptDir.includes('002_B'));
    assert.ok(pptDir.startsWith(lessonDir + path.sep));
  });
});
