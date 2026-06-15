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
    })),
  };

  await mkdir(courseDir, { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

export async function writeLessonMeta(lessonDir, lesson, downloadResults) {
  const metaPath = path.join(lessonDir, 'meta.json');
  const meta = {
    version: '1.0',
    lessonId: lesson.lessonId,
    date: lesson.date,
    title: lesson.title,
    imageCount: lesson.images.length,
    downloadedCount: downloadResults.filter((r) => r.success).length,
    failedCount: downloadResults.filter((r) => !r.success).length,
    images: lesson.images,
    results: downloadResults,
  };

  await mkdir(lessonDir, { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}
