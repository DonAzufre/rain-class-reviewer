# 实现细节

## 模块职责

### `src/index.js`

入口文件，负责：

- 解析 CLI 参数和环境变量（`src/config.js`）。
- 构建或读取 Manifest（`src/manifest.js`）。
- 若需要，触发课程自动发现（`src/discover.js`）。
- 循环处理每个课时：提取 PPT → 并发下载 → 写入元数据 → 汇总报告。
- 根据下载结果退出码：全部成功 `0`，有失败 `1`。

### `src/config.js`

命令行参数解析：

- 支持 `minimist` 风格的参数。
- 环境变量覆盖默认值。
- 校验 `--course` 与 `--manifest` 二选一、工具模式必须提供 `--cookies`。

### `src/manifest.js`

Manifest 读取与校验：

- `readManifest(source)`：从文件或 stdin 读取 JSON。
- `validateAndNormalize(manifest)`：校验必填字段，将旧格式 `images` / `slideManifest` 转换为 `presentations`。
- `cookieString(cookies)`：将 Cookie 对象拼接为 HTTP `Cookie` 头。

转换规则：

| 输入格式 | 转换结果 |
|----------|----------|
| `presentations` 数组 | 保持不变，`needsExtraction = false` |
| `images` 数组 | 包装为单 PPT：`[{ presentationId: lessonId, title, images }]` |
| `slideManifest` | 拼接 URL 后包装为单 PPT |
| 无图片 | `presentations = []`，`needsExtraction = true` |

### `src/discover.js`

课程与课时自动发现：

- `fetchCourseList(manifest)`：`GET /v2/api/web/courses/list?identity=2`。
- `findClassroomByName(courses, courseName)`：严格匹配课程名，多个同名课程时报错。
- `fetchLessonList(manifest, classroomId)`：`GET /v2/api/web/logs/learn/{classroomId}`。
- 课堂记录过滤 `activity.type === 14`（PPT 类型课堂活动）。
- **按 `activity.id` 去重**，保留同一天多次课堂活动。

### `src/extract.js`

幻灯片 URL 提取：

- `buildApiHeaders(manifest, referer)`：构造 HTTP 头，包含 Cookie、`X-CSRFToken`、`classroom-id`、`university-id`、`uv-id` 等。
- `fetchLessonSummary(manifest, lesson)`：调用新版 summary 接口。
- `fetchPresentation(manifest, lesson, presentationId)`：调用新版 presentation 接口。
- `extractLessonPresentations(manifest, lesson)`：组合上述两个接口，返回 `presentations[]`。
- `extractLessonImages(manifest, lesson)`：旧函数别名，兼容旧调用方。
- 新版接口失败时自动回退到 `review` 接口，并输出警告。

### `src/organize.js`

目录与元数据管理：

- `sanitizeDirName(name)`：替换文件系统非法字符，限制长度。
- `getCourseDir(outputRoot, courseName)`：生成课程根目录。
- `getLessonDir(courseDir, lesson)`：生成课时目录，格式 `date_lessonId_title`。
- `getPresentationDir(lessonDir, lesson, presentation, index)`：多 PPT 时返回子目录，单 PPT 时返回课时目录。
- `ensureCourseMeta(courseDir, manifest)`：写入课程级 `meta.json`。
- `writeLessonMeta(lessonDir, lesson, results)`：写入课时级 `meta.json`，包含 `presentations` 下载统计。

### `src/download.js`

图片下载：

- `downloadImage(url, destPath, options)`：使用 `fetch` 下载图片并写入文件，支持 Cookie 头和重试。
- `runWithConcurrency(tasks, concurrency)`：并发控制器，限制同时运行的下载任务数。

### `src/state.js`

下载状态判断：

- `isLessonDownloaded(lessonDir, presentations)`：读取课时 `meta.json`，比较 `totalImages` 与期望页数，失败数为 0 时认为已完成。
- 兼容旧的 `imageCount` 字段和数字型参数。

### `src/report.js`

结果报告：

- `buildReport(manifest, lessonsResults)`：汇总课时数、图片数、成功/失败数。
- `printReport(report, json)`：以表格或 JSON 格式输出。

### `src/llm.js`

MiMo/OpenAI 兼容客户端封装：

- `createClient(apiKey)`：创建 OpenAI 实例，固定 baseURL。
- `extractFromImage(client, model, imageBase64)`：单图提取，返回结构化 JSON。
- `summarizeNotes(client, model, notes[])`：汇总笔记并生成 Markdown。
- `parseJsonResponse(content)`：处理 LLM 返回的 JSON 或 Markdown 代码块。

### `src/extract-notes.js`

逐图笔记提取：

- `findImageFiles(courseDir)`：递归扫描 `.jpg` 图片。
- `readState(courseDir)` / `writeState(courseDir, state)`：维护 `extracted/state.json`。
- `extractNotesFromCourse(options)`：逐页调用 LLM，保存 JSON，支持跳过已提取页面。

### `src/summarize-course.js`

课程级总结：

- `findExtractedNotes(courseDir)`：读取所有提取出的 JSON 笔记。
- `summarizeCourse(options)`：调用 LLM 生成 `review.md`，支持跳过已存在文件。

## 错误处理策略

1. **接口失败**：自动重试（指数退避），重试次数由 `--retry` 控制。
2. **新版接口不可用**：回退到 `review` 接口，继续下载已展示页面。
3. **单张图片下载失败**：记录失败，不影响其他图片，最终退出码为 `1`。
4. **认证失败（403/UNAUTHENTICATED）**：抛出错误，提示更新 Cookie。

## 并发控制

- 课时之间串行处理，避免对雨课堂接口造成过大压力。
- 每张幻灯片下载任务通过 `runWithConcurrency` 并发执行，默认并发数为 3，可通过 `--concurrency` 调整。

## 向后兼容

- 保留 `extractLessonImages` 导出，作为 `extractLessonPresentations` 的别名。
- `state.js` 同时识别新的 `totalImages` 和旧的 `imageCount`。
- Manifest 同时支持 `presentations`、`images`、`slideManifest` 三种格式。
