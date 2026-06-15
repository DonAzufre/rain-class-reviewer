import { createServer } from 'node:http';
import { mkdtempSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=',
  'base64'
);

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': jpeg.length });
  res.end(jpeg);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const tmpDir = mkdtempSync(path.join(tmpdir(), 'rain-test-'));
const manifest = {
  version: '1.0',
  courseName: 'TestCourse',
  classroomId: '999',
  cookies: { sessionid: 'abc' },
  lessons: [{
    lessonId: 'l1',
    date: '2025-01-01',
    title: 'Lesson 1',
    images: [
      `http://127.0.0.1:${port}/slide1.jpg`,
      `http://127.0.0.1:${port}/slide2.jpg`,
    ],
  }],
};

const manifestPath = path.join(tmpDir, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest));

const outputDir = path.join(tmpDir, 'output');
const child = spawn('node', [
  path.join(projectRoot, 'src/index.js'),
  '--manifest', manifestPath,
  '--output', outputDir,
  '--json',
], { cwd: projectRoot });

let stdout = '';
child.stdout.on('data', (d) => { stdout += d; });
child.stderr.on('data', (d) => { process.stderr.write(d); });

child.on('close', (code) => {
  const report = JSON.parse(stdout);
  const lessonDir = path.join(outputDir, 'TestCourse', '2025-01-01_l1_Lesson 1');
  const ok =
    code === 0 &&
    report.summary.totalImages === 2 &&
    report.summary.downloadedImages === 2 &&
    report.summary.failedImages === 0 &&
    existsSync(path.join(lessonDir, '001.jpg')) &&
    existsSync(path.join(lessonDir, '002.jpg'));

  server.closeAllConnections?.();
  server.close(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (ok) {
      console.log('✓ Integration test passed');
      process.exit(0);
    } else {
      console.error('✗ Integration test failed');
      console.error(report);
      process.exit(1);
    }
  });
});
