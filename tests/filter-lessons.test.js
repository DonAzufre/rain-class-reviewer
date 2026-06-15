import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterLessons, buildLessonFilters, hasActiveLessonFilters } from '../src/filter-lessons.js';

describe('filter-lessons', () => {
  const lessons = [
    { lessonId: '1', date: '2026-06-10', title: 'Latest' },
    { lessonId: '2', date: '2026-06-03', title: 'Mid' },
    { lessonId: '3', date: '2026-05-27', title: 'Old' },
  ];

  it('should return all lessons when no filters', () => {
    assert.equal(filterLessons(lessons, {}).length, 3);
  });

  it('should filter by since date', () => {
    const result = filterLessons(lessons, { since: '2026-06-01' });
    assert.equal(result.length, 2);
    assert.equal(result[0].lessonId, '1');
    assert.equal(result[1].lessonId, '2');
  });

  it('should filter by until date', () => {
    const result = filterLessons(lessons, { until: '2026-06-01' });
    assert.equal(result.length, 1);
    assert.equal(result[0].lessonId, '3');
  });

  it('should filter by date range', () => {
    const result = filterLessons(lessons, { since: '2026-05-30', until: '2026-06-05' });
    assert.equal(result.length, 1);
    assert.equal(result[0].lessonId, '2');
  });

  it('should filter by lesson ids', () => {
    const result = filterLessons(lessons, { lessonIds: ['1', '3'] });
    assert.equal(result.length, 2);
    assert.equal(result[0].lessonId, '1');
    assert.equal(result[1].lessonId, '3');
  });

  it('should filter by lesson dates', () => {
    const result = filterLessons(lessons, { lessonDates: ['2026-06-03'] });
    assert.equal(result.length, 1);
    assert.equal(result[0].lessonId, '2');
  });

  it('should return latest lesson', () => {
    const result = filterLessons(lessons, { latest: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].lessonId, '1');
  });

  it('should combine filters', () => {
    const result = filterLessons(lessons, { since: '2026-06-01', lessonIds: ['2'] });
    assert.equal(result.length, 1);
    assert.equal(result[0].lessonId, '2');
  });

  it('should build filters from config', () => {
    const config = {
      since: '2026-06-01',
      until: '2026-06-10',
      latest: true,
      lessonIds: ['1'],
      lessonDates: ['2026-06-10'],
    };
    const filters = buildLessonFilters(config);
    assert.equal(filters.since, '2026-06-01');
    assert.equal(filters.until, '2026-06-10');
    assert.equal(filters.latest, true);
    assert.deepEqual(filters.lessonIds, ['1']);
    assert.deepEqual(filters.lessonDates, ['2026-06-10']);
  });

  it('should detect active filters', () => {
    assert.equal(hasActiveLessonFilters({}), false);
    assert.equal(hasActiveLessonFilters({ latest: true }), true);
    assert.equal(hasActiveLessonFilters({ since: '2026-06-01' }), true);
  });
});
