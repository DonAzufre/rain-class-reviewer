import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findClassroomByName } from '../src/discover.js';

describe('discover', () => {
  it('should find classroom by exact course name', () => {
    const courses = [
      { courseName: '工程伦理概论', classroomId: '123', className: '2班' },
      { courseName: '日语', classroomId: '456', className: '1班' },
    ];

    const result = findClassroomByName(courses, '工程伦理概论');
    assert.equal(result.classroomId, '123');
  });

  it('should throw when course name does not match', () => {
    const courses = [{ courseName: '工程伦理概论', classroomId: '123' }];
    assert.throws(
      () => findClassroomByName(courses, '伦理'),
      /未找到课程/
    );
  });

  it('should throw when multiple courses have same name', () => {
    const courses = [
      { courseName: '形势与政策', classroomId: '123', className: 'A班' },
      { courseName: '形势与政策', classroomId: '456', className: 'B班' },
    ];
    assert.throws(
      () => findClassroomByName(courses, '形势与政策'),
      /多个/
    );
  });
});
