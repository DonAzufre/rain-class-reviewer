import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function countExpectedImages(presentations) {
  if (typeof presentations === 'number') {
    return presentations;
  }

  if (!Array.isArray(presentations)) {
    return 0;
  }

  return presentations.reduce((sum, p) => sum + (p.images?.length || 0), 0);
}

export function isLessonDownloaded(lessonDir, presentations) {
  const metaPath = path.join(lessonDir, 'meta.json');

  if (!existsSync(metaPath)) {
    return false;
  }

  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    const expectedImageCount = countExpectedImages(presentations);
    const actualTotal = meta.totalImages ?? meta.imageCount ?? 0;
    return actualTotal === expectedImageCount && meta.failedCount === 0 && meta.downloadedCount > 0;
  } catch {
    return false;
  }
}
