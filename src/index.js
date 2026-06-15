#!/usr/bin/env node
import { loadConfig } from './config.js';
import { readManifest, validateAndNormalize, cookieString } from './manifest.js';
import { downloadImage, runWithConcurrency } from './download.js';
import { extractLessonImages } from './extract.js';
import { discoverCourse } from './discover.js';
import {
  getCourseDir,
  getLessonDir,
  ensureCourseMeta,
  writeLessonMeta,
  padNumber,
} from './organize.js';
import { isLessonDownloaded } from './state.js';
import { buildReport, printReport } from './report.js';
import path from 'node:path';
import { readFileSync } from 'node:fs';

function buildToolManifest(config) {
  const raw = readFileSync(config.cookies, 'utf-8');
  const cookies = JSON.parse(raw);

  return validateAndNormalize({
    version: '1.0',
    courseName: config.course,
    cookies,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
}

async function main() {
  const config = loadConfig();
  const manifest = config.manifest
    ? readManifest(config.manifest)
    : buildToolManifest(config);
  const cookie = cookieString(manifest.cookies);

  if (manifest.needsDiscovery) {
    await discoverCourse(manifest, config.retry);
  }

  manifest.outputDir = getCourseDir(config.output, manifest.courseName);
  await ensureCourseMeta(manifest.outputDir, manifest);

  const lessonsResults = [];

  for (const lesson of manifest.lessons) {
    const lessonDir = getLessonDir(manifest.outputDir, lesson);

    if (lesson.needsExtraction) {
      const extractedUrls = await extractLessonImages(manifest, lesson, config.retry);
      lesson.images = extractedUrls;
      lesson.needsExtraction = false;
    }

    if (!config.force && isLessonDownloaded(lessonDir, lesson.images.length)) {
      lessonsResults.push({
        lessonId: lesson.lessonId,
        date: lesson.date,
        title: lesson.title,
        totalImages: lesson.images.length,
        downloadedCount: lesson.images.length,
        failedCount: 0,
        skipped: true,
        failedImages: [],
      });
      continue;
    }

    const downloadTasks = lesson.images.map((url, index) => async () => {
      const fileName = `${padNumber(index + 1, 3)}.jpg`;
      const destPath = path.join(lessonDir, fileName);
      const result = await downloadImage(url, destPath, {
        cookie,
        headers: manifest.headers,
        retry: config.retry,
      });

      if (!result.success) {
        return {
          success: false,
          url,
          index: index + 1,
          error: result.error,
        };
      }

      return {
        success: true,
        url,
        index: index + 1,
        path: result.path,
      };
    });

    const results = await runWithConcurrency(downloadTasks, config.concurrency);
    const failedImages = results.filter((r) => !r.success);

    await writeLessonMeta(lessonDir, lesson, results);

    lessonsResults.push({
      lessonId: lesson.lessonId,
      date: lesson.date,
      title: lesson.title,
      totalImages: lesson.images.length,
      downloadedCount: results.filter((r) => r.success).length,
      failedCount: failedImages.length,
      skipped: false,
      failedImages,
    });
  }

  const report = buildReport(manifest, lessonsResults);
  printReport(report, config.json);

  const hasFailures = report.summary.failedImages > 0;
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});
