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

  // 如果 Manifest 文件本身不含 cookies，允许通过 RAIN_COOKIES 环境变量传入
  // 这样可以避免在自动模式下把 Cookie 写入磁盘
  if (!manifest.cookies && process.env.RAIN_COOKIES) {
    try {
      manifest.cookies = JSON.parse(process.env.RAIN_COOKIES);
    } catch (err) {
      throw new Error(`RAIN_COOKIES 环境变量 JSON 解析失败: ${err.message}`);
    }
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
    // 只提供 courseName：自动发现 classroomId 和 lessons
    manifest.needsDiscovery = true;
    manifest.needsLessonDiscovery = false;
    manifest.lessons = [];
    manifest.headers = manifest.headers || {};
    manifest.extractedAt = manifest.extractedAt || new Date().toISOString();
    return manifest;
  }

  if (hasClassroomId && !hasLessons) {
    // 提供了 classroomId 但没有 lessons：自动拉取课时列表
    manifest.needsDiscovery = false;
    manifest.needsLessonDiscovery = true;
    manifest.lessons = [];
    manifest.headers = manifest.headers || {};
    manifest.extractedAt = manifest.extractedAt || new Date().toISOString();
    return manifest;
  }

  if (!manifest.classroomId) {
    throw new Error('Manifest 缺少 classroomId（或移除 lessons 以启用自动发现）');
  }

  if (!hasLessons) {
    throw new Error('Manifest 缺少 lessons 数组或数组为空');
  }

  manifest.needsDiscovery = false;
  manifest.needsLessonDiscovery = false;

  for (const lesson of manifest.lessons) {
    if (!lesson.lessonId) {
      throw new Error('课时缺少 lessonId');
    }

    lesson.presentations = lesson.presentations || [];

    if (Array.isArray(lesson.presentations) && lesson.presentations.length > 0) {
      // 已经提供了完整的多 PPT 结构，无需处理
      lesson.needsExtraction = false;
      continue;
    }

    if (Array.isArray(lesson.images) && lesson.images.length > 0) {
      // 兼容旧的单 PPT images 格式
      lesson.presentations = [{
        presentationId: lesson.lessonId,
        title: lesson.title || '',
        images: lesson.images,
      }];
      lesson.needsExtraction = false;
      continue;
    }

    if (lesson.slideManifest) {
      const images = normalizeSlideManifest(lesson.slideManifest);
      lesson.presentations = [{
        presentationId: lesson.lessonId,
        title: lesson.title || '',
        images,
      }];
      lesson.needsExtraction = false;
      continue;
    }

    // 未提供图片，需要从雨课堂接口提取
    lesson.presentations = [];
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
