import { buildApiHeaders } from './extract.js';

const COURSES_API = 'https://changjiang.yuketang.cn/v2/api/web/courses/list';
const LESSONS_API_BASE = 'https://changjiang.yuketang.cn/v2/api/web/logs/learn';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, headers, retry = 3) {
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
        throw new Error(`接口返回非 JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(`接口 HTTP ${response.status}: ${data.errmsg || data.msg || response.statusText}`);
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

export async function fetchCourseList(manifest, retry = 3) {
  const headers = buildApiHeaders(manifest, 'course-list');
  headers.Referer = 'https://changjiang.yuketang.cn/v2/web/index';
  delete headers['classroom-id'];

  const url = `${COURSES_API}?identity=2`;
  const data = await fetchJson(url, headers, retry);

  if (!data || !Array.isArray(data.list)) {
    throw new Error('课程列表接口返回格式异常');
  }

  return data.list.map((item) => ({
    classroomId: String(item.classroom_id),
    courseName: item.course?.name,
    className: item.name,
    teacher: item.teacher?.name,
    courseId: item.course?.id,
    raw: item,
  }));
}

export function findClassroomByName(courses, courseName) {
  if (!courseName) {
    throw new Error('必须提供 courseName 用于课程匹配');
  }

  const normalizedInput = courseName.trim();
  const matches = courses.filter((c) => c.courseName === normalizedInput);

  if (matches.length === 0) {
    const available = courses.map((c) => c.courseName).filter(Boolean);
    throw new Error(
      `未找到课程 "${normalizedInput}"。可用课程：\n${available.slice(0, 20).join('\n')}`
    );
  }

  if (matches.length > 1) {
    const candidates = matches
      .map((c) => `- ${c.courseName}（班级：${c.className}，classroomId：${c.classroomId}）`)
      .join('\n');
    throw new Error(
      `找到多个名为 "${normalizedInput}" 的课程，请指定 classroomId：\n${candidates}`
    );
  }

  return matches[0];
}

export async function fetchLessonList(manifest, classroomId, retry = 3) {
  const headers = buildApiHeaders(manifest, 'lesson-list');
  headers.Referer = `https://changjiang.yuketang.cn/v2/web/studentLog/${classroomId}`;
  headers['classroom-id'] = String(classroomId);

  const url = `${LESSONS_API_BASE}/${classroomId}?actype=-1&page=0&offset=100&sort=-1`;
  const data = await fetchJson(url, headers, retry);

  if (!data || !Array.isArray(data.activities)) {
    throw new Error('课堂记录接口返回格式异常');
  }

  const lessons = data.activities
    .filter((activity) => activity.type === 14)
    .map((activity) => ({
      lessonId: String(activity.courseware_id),
      date: new Date(activity.create_time).toISOString().slice(0, 10),
      title: activity.title || '',
      activityId: String(activity.id),
      raw: activity,
    }));

  return deduplicateByActivityId(lessons);
}

function deduplicateByActivityId(lessons) {
  const seen = new Set();
  const result = [];

  for (const lesson of lessons) {
    if (seen.has(lesson.activityId)) {
      continue;
    }
    seen.add(lesson.activityId);
    result.push(lesson);
  }

  return result;
}

export async function discoverCourse(manifest, retry = 3) {
  if (!manifest.courseName) {
    throw new Error('自动发现需要 manifest 提供 courseName');
  }

  const courses = await fetchCourseList(manifest, retry);
  const course = findClassroomByName(courses, manifest.courseName);

  manifest.classroomId = course.classroomId;
  const lessons = await fetchLessonList(manifest, course.classroomId, retry);

  if (lessons.length === 0) {
    throw new Error(`课程 "${manifest.courseName}" 未找到任何课堂记录`);
  }

  manifest.lessons = lessons.map((l) => ({
    lessonId: l.lessonId,
    activityId: l.activityId,
    date: l.date,
    title: l.title,
    needsExtraction: true,
    images: [],
  }));

  return manifest;
}
