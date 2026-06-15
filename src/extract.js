import { cookieString } from './manifest.js';

const REVIEW_API_BASE = 'https://changjiang.yuketang.cn/api/v3/classroom-report/student/review';
const DETAIL_API_BASE = 'https://changjiang.yuketang.cn/api/v3/classroom-report/student/detail';
const LESSON_SUMMARY_API = 'https://changjiang.yuketang.cn/api/v3/lesson-summary/student';
const PRESENTATION_API = 'https://changjiang.yuketang.cn/api/v3/lesson-summary/student/presentation';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildApiHeaders(manifest, referer) {
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
    Referer: referer || `https://changjiang.yuketang.cn/`,
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

function buildV3Referer(manifest, lesson) {
  const classroomId = manifest.classroomId;
  const lessonId = lesson.lessonId;
  const activityId = lesson.activityId || '';
  return `https://changjiang.yuketang.cn/v2/web/student-v3/${classroomId}/${lessonId}/${activityId}`;
}

async function fetchJson(url, options = {}, retry = 3) {
  const { headers, body, method = 'GET' } = options;
  let lastError;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'follow',
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`接口返回非 JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(`接口 HTTP ${response.status}: ${data.msg || data.errmsg || response.statusText}`);
      }

      if (data.errcode !== undefined && data.errcode !== 0) {
        throw new Error(`接口业务错误 [${data.errcode}]: ${data.errmsg || '未知错误'}`);
      }

      if (data.code !== undefined && data.code !== 0) {
        throw new Error(`接口业务错误 [${data.code}]: ${data.msg || '未知错误'}`);
      }

      return data.data;
    } catch (err) {
      lastError = err;
      if (attempt < retry) {
        await sleep(Math.min(1000 * 2 ** attempt, 10000));
      }
    }
  }

  throw lastError;
}

export async function fetchLessonSummary(manifest, lesson, retry = 3) {
  const referer = buildV3Referer(manifest, lesson);
  const headers = buildApiHeaders(manifest, referer);
  const url = `${LESSON_SUMMARY_API}?lesson_id=${encodeURIComponent(lesson.lessonId)}`;

  return fetchJson(url, { headers }, retry);
}

export async function fetchPresentation(manifest, lesson, presentationId, retry = 3) {
  const referer = buildV3Referer(manifest, lesson);
  const headers = buildApiHeaders(manifest, referer);
  const url = `${PRESENTATION_API}?presentation_id=${encodeURIComponent(presentationId)}&lesson_id=${encodeURIComponent(lesson.lessonId)}`;

  return fetchJson(url, { headers }, retry);
}

export async function extractLessonPresentations(manifest, lesson, retry = 3) {
  try {
    const summary = await fetchLessonSummary(manifest, lesson, retry);
    const presentations = summary?.presentations || [];

    if (presentations.length === 0) {
      throw new Error(`lesson ${lesson.lessonId} 未找到任何 PPT`);
    }

    const results = [];
    for (const ppt of presentations) {
      const data = await fetchPresentation(manifest, lesson, ppt.id, retry);
      const images = data?.slides?.map((slide) => slide.cover).filter(Boolean) || [];
      results.push({
        presentationId: String(ppt.id),
        title: ppt.title || '',
        images,
      });
    }

    return results;
  } catch (err) {
    console.warn(
      `lesson ${lesson.lessonId} 使用新版接口失败: ${err.message}，尝试回退到 review 接口（可能不完整）`
    );
    return extractLessonImagesAsPresentations(manifest, lesson, retry);
  }
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

async function fetchReviewTimeline(manifest, lessonId, retry = 3) {
  const referer = `https://changjiang.yuketang.cn/m/v2/lesson/student/${lessonId}/overview`;
  const headers = buildApiHeaders(manifest, referer);
  const frontTime = Date.now();
  const url = `${REVIEW_API_BASE}?lesson_id=${encodeURIComponent(lessonId)}&front_time=${frontTime}`;

  return fetchJson(url, { headers }, retry);
}

async function fetchLessonDetail(manifest, lessonId, retry = 1) {
  const referer = `https://changjiang.yuketang.cn/m/v2/lesson/student/${lessonId}/overview`;
  const headers = buildApiHeaders(manifest, referer);
  const frontTime = Date.now();
  const url = `${DETAIL_API_BASE}?lesson_id=${encodeURIComponent(lessonId)}&front_time=${frontTime}`;

  try {
    return await fetchJson(url, { headers }, retry);
  } catch {
    return null;
  }
}

async function extractLessonImagesAsPresentations(manifest, lesson, retry = 3) {
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

  const expected = detailData?.presentation?.reduce((sum, p) => sum + (p.totalCount || 0), 0) || null;
  if (expected && urls.length < expected) {
    console.warn(
      `警告: lesson ${lesson.lessonId} 课件共 ${expected} 页，本次仅提取到 ${urls.length} 页（课堂中展示过的幻灯片）`
    );
  }

  return [{
    presentationId: lesson.lessonId,
    title: lesson.title || '',
    images: urls,
  }];
}

export async function extractLessonImages(manifest, lesson, retry = 3) {
  return extractLessonPresentations(manifest, lesson, retry);
}

export async function extractAllLessonImages(manifest, retry = 3) {
  const results = [];
  for (const lesson of manifest.lessons) {
    const presentations = await extractLessonPresentations(manifest, lesson, retry);
    results.push({ lesson, presentations });
  }
  return results;
}
