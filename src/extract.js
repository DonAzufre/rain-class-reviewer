import { cookieString } from './manifest.js';

const REVIEW_API_BASE = 'https://changjiang.yuketang.cn/api/v3/classroom-report/student/review';
const DETAIL_API_BASE = 'https://changjiang.yuketang.cn/api/v3/classroom-report/student/detail';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildApiHeaders(manifest, lessonId) {
  const cookies = manifest.cookies || {};
  const headers = manifest.headers || {};
  const classroomId = manifest.classroomId;
  const universityId = cookies.university_id || headers['university-id'];
  const uvId = cookies.uv_id || headers['uv-id'];

  if (!cookies.sessionid) {
    throw new Error('cookies 中缺少 sessionid，无法调用雨课堂接口');
  }

  return {
    Cookie: cookieString(cookies),
    'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Referer: `https://changjiang.yuketang.cn/m/v2/lesson/student/${lessonId}/overview`,
    Accept: 'application/json, text/plain, */*',
    'X-CSRFToken': cookies.csrftoken || '',
    'classroom-id': classroomId ? String(classroomId) : '',
    'university-id': universityId ? String(universityId) : '',
    'uv-id': uvId ? String(uvId) : '',
    'xtbz': cookies.xtbz || 'ykt',
    'xt-agent': 'web',
    'x-client': 'web',
  };
}

export function extractSlideUrls(timelineList) {
  if (!Array.isArray(timelineList)) {
    throw new Error('review API 返回的 timelineList 不是数组');
  }

  const visibleSlides = timelineList.filter(
    (item) => item.type === 'slide' && item.visible !== false && item.cover
  );

  const byIndex = new Map();
  for (const item of visibleSlides) {
    const existing = byIndex.get(item.index);
    if (!existing || item.firstTime < existing.firstTime) {
      byIndex.set(item.index, item);
    }
  }

  const sorted = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.cover);
}

export async function fetchReviewTimeline(manifest, lessonId, retry = 3) {
  const headers = buildApiHeaders(manifest, lessonId);
  const frontTime = Date.now();
  const url = `${REVIEW_API_BASE}?lesson_id=${encodeURIComponent(lessonId)}&front_time=${frontTime}`;

  let lastError;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`review API 返回非 JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(`review API HTTP ${response.status}: ${data.msg || response.statusText}`);
      }

      if (data.code !== 0) {
        throw new Error(`review API 业务错误 [${data.code}]: ${data.msg || '未知错误'}`);
      }

      return data.data;
    } catch (err) {
      lastError = err;
      if (attempt < retry) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        await sleep(delay);
      }
    }
  }

  throw new Error(`获取 lesson ${lessonId} 幻灯片信息失败: ${lastError.message}`);
}

export async function fetchLessonDetail(manifest, lessonId, retry = 1) {
  const headers = buildApiHeaders(manifest, lessonId);
  const frontTime = Date.now();
  const url = `${DETAIL_API_BASE}?lesson_id=${encodeURIComponent(lessonId)}&front_time=${frontTime}`;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (!response.ok || data.code !== 0) {
        return null;
      }

      return data.data;
    } catch {
      if (attempt < retry) await sleep(1000);
    }
  }

  return null;
}

function getExpectedSlideCount(detailData) {
  if (!detailData || !Array.isArray(detailData.presentation)) {
    return null;
  }
  return detailData.presentation.reduce((sum, p) => sum + (p.totalCount || 0), 0);
}

export async function extractLessonImages(manifest, lesson, retry = 3) {
  const [reviewData, detailData] = await Promise.all([
    fetchReviewTimeline(manifest, lesson.lessonId, retry),
    fetchLessonDetail(manifest, lesson.lessonId, 1),
  ]);

  if (!reviewData || !Array.isArray(reviewData.timelineList)) {
    throw new Error(`lesson ${lesson.lessonId} 的 review API 返回缺少 timelineList`);
  }

  const urls = extractSlideUrls(reviewData.timelineList);
  if (urls.length === 0) {
    throw new Error(`lesson ${lesson.lessonId} 未提取到任何幻灯片图片`);
  }

  const expected = getExpectedSlideCount(detailData);
  if (expected && urls.length < expected) {
    console.warn(
      `警告: lesson ${lesson.lessonId} 课件共 ${expected} 页，本次仅提取到 ${urls.length} 页（课堂中展示过的幻灯片）。如需完整课件，请通过浏览器滚动加载全部幻灯片后提供 images 数组。`
    );
  }

  return urls;
}

export async function extractAllLessonImages(manifest, retry = 3) {
  const results = [];
  for (const lesson of manifest.lessons) {
    const urls = await extractLessonImages(manifest, lesson, retry);
    results.push({ lesson, urls });
  }
  return results;
}
