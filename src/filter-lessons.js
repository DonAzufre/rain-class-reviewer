export function filterLessons(lessons, filters = {}) {
  if (!Array.isArray(lessons)) {
    throw new Error('lessons 必须是数组');
  }

  let result = lessons.slice();

  if (filters.latest) {
    // 按日期降序，取第一个
    result = result
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return result.slice(0, 1);
  }

  if (filters.since) {
    const sinceDate = normalizeDate(filters.since);
    result = result.filter((l) => String(l.date) >= sinceDate);
  }

  if (filters.until) {
    const untilDate = normalizeDate(filters.until);
    result = result.filter((l) => String(l.date) <= untilDate);
  }

  if (filters.lessonDates && filters.lessonDates.length > 0) {
    const dates = new Set(filters.lessonDates.map(normalizeDate));
    result = result.filter((l) => dates.has(String(l.date)));
  }

  if (filters.lessonIds && filters.lessonIds.length > 0) {
    const ids = new Set(filters.lessonIds.map(String));
    result = result.filter((l) => ids.has(String(l.lessonId)));
  }

  return result;
}

function normalizeDate(date) {
  const normalized = String(date).trim();
  // 支持 YYYY-MM-DD 或 YYYY/MM/DD
  return normalized.replace(/\//g, '-');
}

export function buildLessonFilters(config) {
  const filters = {};

  if (config.latest) {
    filters.latest = true;
  }

  if (config.since) {
    filters.since = config.since;
  }

  if (config.until) {
    filters.until = config.until;
  }

  if (config.lessonIds && config.lessonIds.length > 0) {
    filters.lessonIds = config.lessonIds;
  }

  if (config.lessonDates && config.lessonDates.length > 0) {
    filters.lessonDates = config.lessonDates;
  }

  return filters;
}

export function hasActiveLessonFilters(filters) {
  return Object.keys(filters).length > 0;
}
