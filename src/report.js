export function buildReport(manifest, lessonsResults) {
  const totalLessons = manifest.lessons.length;
  const successfulLessons = lessonsResults.filter((r) => r.failedCount === 0).length;
  const failedLessons = lessonsResults.filter((r) => r.failedCount > 0);
  const totalImages = lessonsResults.reduce((sum, r) => sum + r.totalImages, 0);
  const downloadedImages = lessonsResults.reduce((sum, r) => sum + r.downloadedCount, 0);
  const failedImages = lessonsResults.reduce((sum, r) => sum + r.failedCount, 0);

  return {
    courseName: manifest.courseName,
    classroomId: manifest.classroomId,
    outputDir: manifest.outputDir,
    extractedAt: manifest.extractedAt,
    summary: {
      totalLessons,
      successfulLessons,
      failedLessonsCount: failedLessons.length,
      skippedLessons: lessonsResults.filter((r) => r.skipped).length,
      totalImages,
      downloadedImages,
      failedImages,
    },
    lessons: lessonsResults,
    failures: failedLessons.flatMap((lesson) =>
      lesson.failedImages.map((failure) => ({
        lessonId: lesson.lessonId,
        date: lesson.date,
        title: lesson.title,
        ...failure,
      }))
    ),
  };
}

export function printReport(report, useJson = false) {
  if (useJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const { summary } = report;
  console.log('\n========== 下载报告 ==========');
  console.log(`课程: ${report.courseName}`);
  console.log(`输出目录: ${report.outputDir}`);
  console.log(`提取时间: ${report.extractedAt}`);
  console.log('');
  console.log(`课时总数: ${summary.totalLessons}`);
  console.log(`成功课时: ${summary.successfulLessons}`);
  console.log(`失败课时: ${summary.failedLessonsCount}`);
  console.log(`跳过课时: ${summary.skippedLessons}`);
  console.log(`图片总数: ${summary.totalImages}`);
  console.log(`下载成功: ${summary.downloadedImages}`);
  console.log(`下载失败: ${summary.failedImages}`);

  if (report.failures.length > 0) {
    console.log('\n---------- 失败详情 ----------');
    for (const failure of report.failures) {
      console.log(`[${failure.lessonId}] ${failure.date} ${failure.title}`);
      console.log(`  URL: ${failure.url}`);
      console.log(`  原因: ${failure.error}`);
    }
  }

  console.log('==============================\n');
}
