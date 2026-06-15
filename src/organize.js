import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sanitizeDirName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

export function padNumber(num, length) {
  return String(num).padStart(length, '0');
}

export function getCourseDir(outputRoot, courseName) {
  return path.join(outputRoot, sanitizeDirName(courseName));
}

export function getLessonDir(courseDir, lesson) {
  const date = lesson.date || 'unknown';
  const safeTitle = sanitizeDirName(lesson.title || '').slice(0, 50);
  const dirName = safeTitle ? `${date}_${lesson.lessonId}_${safeTitle}` : `${date}_${lesson.lessonId}`;
  return path.join(courseDir, dirName);
}

export function getPresentationDir(lessonDir, lesson, presentation, presentationIndex) {
  const presentations = Array.isArray(lesson.presentations) ? lesson.presentations : [];
  if (presentations.length <= 1) {
    return lessonDir;
  }

  const safeTitle = sanitizeDirName(presentation.title || '').slice(0, 80);
  const dirName = safeTitle
    ? `${padNumber(presentationIndex + 1, 3)}_${safeTitle}`
    : `${padNumber(presentationIndex + 1, 3)}`;
  return path.join(lessonDir, dirName);
}

export async function ensureCourseMeta(courseDir, manifest) {
  const metaPath = path.join(courseDir, 'meta.json');
  const meta = {
    version: '1.0',
    courseName: manifest.courseName,
    classroomId: manifest.classroomId,
    extractedAt: manifest.extractedAt,
    totalLessons: manifest.lessons.length,
    lessons: manifest.lessons.map((l) => ({
      lessonId: l.lessonId,
      date: l.date,
      title: l.title,
      presentationCount: Array.isArray(l.presentations) ? l.presentations.length : 0,
    })),
  };

  await mkdir(courseDir, { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

function buildPresentationsMeta(lesson, downloadResults) {
  const presentations = Array.isArray(lesson.presentations) ? lesson.presentations : [];

  return presentations.map((ppt) => {
    const pptResults = downloadResults.filter((r) => r.presentationId === ppt.presentationId);
    return {
      presentationId: ppt.presentationId,
      title: ppt.title,
      imageCount: (ppt.images || []).length,
      downloadedCount: pptResults.filter((r) => r.success).length,
      failedCount: pptResults.filter((r) => !r.success).length,
      images: ppt.images || [],
    };
  });
}

export async function writeLessonMeta(lessonDir, lesson, downloadResults) {
  const metaPath = path.join(lessonDir, 'meta.json');
  const presentations = buildPresentationsMeta(lesson, downloadResults);
  const totalImages = presentations.reduce((sum, p) => sum + p.imageCount, 0);
  const downloadedCount = downloadResults.filter((r) => r.success).length;
  const failedCount = downloadResults.filter((r) => !r.success).length;

  const meta = {
    version: '1.0',
    lessonId: lesson.lessonId,
    date: lesson.date,
    title: lesson.title,
    activityId: lesson.activityId,
    totalImages,
    downloadedCount,
    failedCount,
    presentations,
    results: downloadResults,
  };

  await mkdir(lessonDir, { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}
