import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

describe('config', () => {
  beforeEach(() => {
    process.env.RAIN_COOKIES = JSON.stringify({ sessionid: 'abc' });
  });

  afterEach(() => {
    delete process.env.RAIN_COOKIES;
  });

  it('should load config from args', () => {
    const config = loadConfig(['node', 'index.js', '--manifest', './test.json', '--concurrency', '5']);
    assert.equal(config.manifest, './test.json');
    assert.equal(config.concurrency, 5);
    assert.equal(config.retry, 3);
    assert.equal(config.force, false);
    assert.equal(config.json, false);
  });

  it('should load tool mode config from args', () => {
    const config = loadConfig(['node', 'index.js', '--course', '工程伦理概论']);
    assert.equal(config.course, '工程伦理概论');
  });

  it('should parse classroom-id and default output dir', () => {
    const config = loadConfig(['node', 'index.js', '--course', '工程伦理概论', '--classroom-id', '13522533']);
    assert.equal(config.classroomId, '13522533');
    assert.ok(config.output.endsWith('rain-class-reviewer-downloads'));
  });

  it('should throw when manifest and course are both missing', () => {
    assert.throws(() => loadConfig(['node', 'index.js']), /manifest|course/);
  });

  it('should throw when tool mode lacks RAIN_COOKIES env', () => {
    delete process.env.RAIN_COOKIES;
    assert.throws(() => loadConfig(['node', 'index.js', '--course', '工程伦理概论']), /RAIN_COOKIES/);
  });

  it('should parse latest filter', () => {
    const config = loadConfig(['node', 'index.js', '--course', '工程伦理概论', '--latest']);
    assert.equal(config.latest, true);
  });

  it('should parse since and until filters', () => {
    const config = loadConfig(['node', 'index.js', '--course', '工程伦理概论', '--since', '2026-06-01', '--until', '2026-06-10']);
    assert.equal(config.since, '2026-06-01');
    assert.equal(config.until, '2026-06-10');
  });

  it('should parse multiple lesson-id and lesson-date filters', () => {
    const config = loadConfig([
      'node', 'index.js', '--course', '工程伦理概论',
      '--lesson-id', '123',
      '--lesson-id', '456',
      '--lesson-date', '2026-06-01',
      '--lesson-date', '2026-06-02',
    ]);
    assert.deepEqual(config.lessonIds, ['123', '456']);
    assert.deepEqual(config.lessonDates, ['2026-06-01', '2026-06-02']);
  });
});
