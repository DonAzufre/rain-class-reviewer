import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function isLessonDownloaded(lessonDir, expectedImageCount) {
  const metaPath = path.join(lessonDir, 'meta.json');

  if (!existsSync(metaPath)) {
    return false;
  }

  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    return meta.downloadedCount === expectedImageCount && meta.failedCount === 0;
  } catch {
    return false;
  }
}
