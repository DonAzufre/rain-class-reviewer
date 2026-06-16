import { readManifest, validateAndNormalize } from './manifest.js';
import { fetchCourseList } from './discover.js';

export function buildToolManifest(config) {
  return validateAndNormalize({
    version: '1.0',
    courseName: config.course,
    classroomId: config.classroomId,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
}

export async function runVerifyAuth(config) {
  const manifest = config.manifest
    ? readManifest(config.manifest)
    : buildToolManifest(config);

  try {
    const courses = await fetchCourseList(manifest, config.retry);
    const message = `认证有效，已发现 ${courses.length} 门课程`;
    if (config.json) {
      console.log(JSON.stringify({ ok: true, courseCount: courses.length, message }));
    } else {
      console.log(message);
    }
    return { ok: true };
  } catch (err) {
    const message = `认证校验失败: ${err.message}`;
    if (config.json) {
      console.log(JSON.stringify({ ok: false, error: err.message, message }));
    } else {
      console.error(message);
    }
    return { ok: false, error: err };
  }
}

export async function runListCourses(config) {
  const manifest = config.manifest
    ? readManifest(config.manifest)
    : buildToolManifest(config);

  try {
    const courses = await fetchCourseList(manifest, config.retry);
    const list = courses.map((c) => ({
      classroomId: c.classroomId,
      courseName: c.courseName,
      className: c.className,
      teacher: c.teacher,
    }));

    if (config.json) {
      console.log(JSON.stringify({ ok: true, courses: list }));
    } else {
      for (const c of list) {
        console.log(`${c.classroomId}\t${c.courseName}\t${c.className}\t${c.teacher || ''}`);
      }
    }
    return { ok: true, courses: list };
  } catch (err) {
    const message = `获取课程列表失败: ${err.message}`;
    if (config.json) {
      console.log(JSON.stringify({ ok: false, error: err.message, message }));
    } else {
      console.error(message);
    }
    return { ok: false, error: err };
  }
}
