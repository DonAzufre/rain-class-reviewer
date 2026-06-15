import { readFileSync } from 'node:fs';

const URL_TEMPLATE = 'https://changjiang-private-qn.yuketang.cn/slide/{slideId}/cover{coverId}_{timestamp}.jpg?e={expire}&token={token}';

function buildSlideUrl(slideId, coverId, timestamp, expire, token) {
  return URL_TEMPLATE
    .replace('{slideId}', slideId)
    .replace('{coverId}', coverId)
    .replace('{timestamp}', timestamp)
    .replace('{expire}', expire)
    .replace('{token}', token);
}

function normalizeSlideManifest(slideManifest) {
  const { slideId, expire, tokenBase, timestamp, slideDetails } = slideManifest;

  if (!slideId || !expire || !tokenBase || !Array.isArray(slideDetails)) {
    throw new Error('slideManifest 缺少必要字段: slideId, expire, tokenBase, slideDetails');
  }

  return slideDetails.map((detail) => {
    const { coverId, tokenSuffix } = detail;
    if (!coverId || !tokenSuffix) {
      throw new Error('slideDetails 项缺少 coverId 或 tokenSuffix');
    }

    const ts = timestamp || detail.timestamp;
    if (!ts) {
      throw new Error(`无法确定 coverId=${coverId} 的图片 timestamp`);
    }

    return buildSlideUrl(slideId, coverId, ts, expire, `${tokenBase}:${tokenSuffix}`);
  });
}

export function readManifest(source) {
  let raw;

  if (source === '-') {
    raw = readFileSync(0, 'utf-8');
  } else {
    raw = readFileSync(source, 'utf-8');
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Manifest JSON 解析失败: ${err.message}`);
  }

  validateAndNormalize(manifest);
  return manifest;
}

export function validateAndNormalize(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest 必须是 JSON 对象');
  }

  if (!manifest.courseName) {
    throw new Error('Manifest 缺少 courseName');
  }

  if (!manifest.cookies || typeof manifest.cookies !== 'object') {
    throw new Error('Manifest 缺少 cookies 对象');
  }

  const hasLessons = Array.isArray(manifest.lessons) && manifest.lessons.length > 0;
  const hasClassroomId = Boolean(manifest.classroomId);

  if (!hasClassroomId && !hasLessons) {
    // 允许只提供 courseName，由工具自动发现 classroomId 和 lessons
    manifest.needsDiscovery = true;
    manifest.lessons = [];
    manifest.headers = manifest.headers || {};
    manifest.extractedAt = manifest.extractedAt || new Date().toISOString();
    return manifest;
  }

  if (!manifest.classroomId) {
    throw new Error('Manifest 缺少 classroomId（或移除 lessons 以启用自动发现）');
  }

  if (!hasLessons) {
    throw new Error('Manifest 缺少 lessons 数组或数组为空（或移除 classroomId 以启用自动发现）');
  }

  manifest.needsDiscovery = false;

  for (const lesson of manifest.lessons) {
    if (!lesson.lessonId) {
      throw new Error('课时缺少 lessonId');
    }

    if (Array.isArray(lesson.images) && lesson.images.length > 0) {
      // 已经是完整 URL 格式，无需处理
      lesson.needsExtraction = false;
      continue;
    }

    if (lesson.slideManifest) {
      lesson.images = normalizeSlideManifest(lesson.slideManifest);
      lesson.needsExtraction = false;
      continue;
    }

    // 未提供图片，需要从雨课堂接口提取
    lesson.images = [];
    lesson.needsExtraction = true;
  }

  manifest.headers = manifest.headers || {};
  manifest.extractedAt = manifest.extractedAt || new Date().toISOString();

  return manifest;
}

export function cookieString(cookies) {
  return Object.entries(cookies)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('; ');
}
