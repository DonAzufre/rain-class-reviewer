#!/usr/bin/env node
import { loadConfig, loadApiKey } from './config.js';
import { readManifest, validateAndNormalize, cookieString } from './manifest.js';
import { downloadImage, runWithConcurrency } from './download.js';
import { extractLessonImages } from './extract.js';
import { discoverCourse } from './discover.js';
import { filterLessons, buildLessonFilters, hasActiveLessonFilters } from './filter-lessons.js';
import {
  getCourseDir,
  getLessonDir,
  getPresentationDir,
  ensureCourseMeta,
  writeLessonMeta,
  padNumber,
} from './organize.js';
import { isLessonDownloaded } from './state.js';
import { buildReport, printReport } from './report.js';
import { createClient } from './llm.js';
import { extractNotesFromCourse } from './extract-notes.js';
import { summarizeCourse } from './summarize-course.js';
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

async function runDownload(config) {
  const manifest = config.manifest
    ? readManifest(config.manifest)
    : buildToolManifest(config);
  const cookie = cookieString(manifest.cookies);

  if (manifest.needsDiscovery) {
    await discoverCourse(manifest, config.retry);
  }

  const lessonFilters = buildLessonFilters(config);
  if (hasActiveLessonFilters(lessonFilters)) {
    const originalCount = manifest.lessons.length;
    manifest.lessons = filterLessons(manifest.lessons, lessonFilters);

    if (manifest.lessons.length === 0) {
      throw new Error('过滤后没有匹配的课时，请检查 --since/--until/--lesson-id/--lesson-date 参数');
    }

    if (!config.json) {
      console.log(`课时过滤: 从 ${originalCount} 个课时中匹配到 ${manifest.lessons.length} 个`);
    }
  }

  manifest.outputDir = getCourseDir(config.output, manifest.courseName);
  await ensureCourseMeta(manifest.outputDir, manifest);

  const lessonsResults = [];

  for (const lesson of manifest.lessons) {
    const lessonDir = getLessonDir(manifest.outputDir, lesson);

    if (lesson.needsExtraction) {
      const presentations = await extractLessonImages(manifest, lesson, config.retry);
      lesson.presentations = presentations;
      lesson.needsExtraction = false;
    }

    const presentations = Array.isArray(lesson.presentations) ? lesson.presentations : [];
    const totalImages = presentations.reduce((sum, p) => sum + (p.images?.length || 0), 0);

    if (!config.force && isLessonDownloaded(lessonDir, presentations)) {
      lessonsResults.push({
        lessonId: lesson.lessonId,
        date: lesson.date,
        title: lesson.title,
        totalImages,
        downloadedCount: totalImages,
        failedCount: 0,
        skipped: true,
        failedImages: [],
      });
      continue;
    }

    const allDownloadTasks = [];
    let completedCount = 0;
    const progressInterval = Math.max(1, Math.floor(totalImages / 10));

    for (const [pptIndex, ppt] of presentations.entries()) {
      const pptDir = getPresentationDir(lessonDir, lesson, ppt, pptIndex);

      const tasks = (ppt.images || []).map((url, index) => async () => {
        const fileName = `${padNumber(index + 1, 3)}.jpg`;
        const destPath = path.join(pptDir, fileName);
        const result = await downloadImage(url, destPath, {
          cookie,
          headers: manifest.headers,
          retry: config.retry,
        });

        completedCount += 1;
        if (!config.json && completedCount % progressInterval === 0) {
          console.log(`  [${completedCount}/${totalImages}] 下载进度 ${lesson.title || lesson.lessonId}`);
        }

        return {
          success: result.success,
          url,
          index: index + 1,
          presentationId: ppt.presentationId,
          presentationTitle: ppt.title,
          path: result.path,
          error: result.error,
        };
      });

      allDownloadTasks.push(...tasks);
    }

    if (!config.json && totalImages > 0) {
      console.log(`开始下载: ${lesson.date} ${lesson.title} (${totalImages} 张图片)`);
    }

    const results = await runWithConcurrency(allDownloadTasks, config.concurrency);
    const failedImages = results.filter((r) => !r.success);

    await writeLessonMeta(lessonDir, lesson, results);

    lessonsResults.push({
      lessonId: lesson.lessonId,
      date: lesson.date,
      title: lesson.title,
      totalImages,
      downloadedCount: results.filter((r) => r.success).length,
      failedCount: failedImages.length,
      skipped: false,
      failedImages,
    });
  }

  const report = buildReport(manifest, lessonsResults);
  printReport(report, config.json);

  const hasFailures = report.summary.failedImages > 0;
  return { hasFailures, report };
}

async function runSummarize(config) {
  const apiKey = loadApiKey(config);
  const client = createClient(apiKey);

  console.log(`开始提取笔记: ${config.courseDir}`);
  const extractionReport = await extractNotesFromCourse({
    client,
    courseDir: config.courseDir,
    lessonDir: config.lessonDir,
    extractModel: config.extractModel,
    force: config.force || config.forceSummary,
    concurrency: config.extractConcurrency,
    onProgress: ({ current, total, relKey, skipped, error }) => {
      const status = error ? '失败' : skipped ? '跳过' : '完成';
      console.log(`[${current}/${total}] ${status} ${relKey}${error ? `: ${error}` : ''}`);
    },
  });

  console.log(`\n提取完成: 成功 ${extractionReport.success}/${extractionReport.total}, 失败 ${extractionReport.failed}`);

  console.log('\n开始生成复习大纲...');
  const summaryReport = await summarizeCourse({
    client,
    courseDir: config.courseDir,
    lessonDir: config.lessonDir,
    model: config.model,
    force: config.forceSummary,
  });

  if (summaryReport.skipped) {
    console.log(`复习大纲已存在，已跳过: ${summaryReport.reviewPath}`);
  } else {
    console.log(`复习大纲已生成: ${summaryReport.reviewPath} (基于 ${summaryReport.noteCount} 页笔记)`);
  }

  return { hasFailures: extractionReport.failed > 0, extractionReport, summaryReport };
}

async function main() {
  const config = loadConfig();

  if (config.summarize) {
    const { hasFailures } = await runSummarize(config);
    process.exitCode = hasFailures ? 1 : 0;
    return;
  }

  const { hasFailures } = await runDownload(config);
  process.exitCode = hasFailures ? 1 : 0;
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exitCode = 1;
});
