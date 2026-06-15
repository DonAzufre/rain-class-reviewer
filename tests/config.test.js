import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

describe('config', () => {
  it('should load config from args', () => {
    const config = loadConfig(['node', 'index.js', '--manifest', './test.json', '--concurrency', '5']);
    assert.equal(config.manifest, './test.json');
    assert.equal(config.concurrency, 5);
    assert.equal(config.retry, 3);
    assert.equal(config.force, false);
    assert.equal(config.json, false);
  });

  it('should load tool mode config from args', () => {
    const config = loadConfig(['node', 'index.js', '--course', '工程伦理概论', '--cookies', './cookies.json']);
    assert.equal(config.course, '工程伦理概论');
    assert.equal(config.cookies, './cookies.json');
  });

  it('should throw when manifest and course are both missing', () => {
    assert.throws(() => loadConfig(['node', 'index.js']), /manifest|course/);
  });

  it('should throw when tool mode lacks cookies', () => {
    assert.throws(() => loadConfig(['node', 'index.js', '--course', '工程伦理概论']), /cookies/);
  });
});
