# 设计文档

## 设计原则

1. **工具与浏览器解耦**
   - 工具本身不连接浏览器，只接收课程名/Cookie 或 Agent 提取的 Manifest。
   - Chrome DevTools MCP 相关交互（登录态检查、课程模糊匹配、Cookie 读取）由 Agent/Skill 负责。

2. **接口优先，浏览器兜底**
   - 优先调用雨课堂官方接口获取完整 PPT。
   - 当接口不可用时，允许回退到课堂展示过的幻灯片，并明确告知用户。

3. **可重复、可恢复**
   - 每个课时生成 `meta.json`，记录下载状态，支持断点续传和跳过已下载课时。
   - 失败图片可在重试后补齐，无需重新下载整个课程。

4. **向后兼容**
   - 旧的 `images` 和 `slideManifest` 格式仍然受支持，自动转换为新的 `presentations` 模型。

## 系统架构

```
┌─────────────────┐
│   CLI / Skill   │
│  (src/index.js) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Manifest 层    │────▶│  自动发现 (discover)
│ (src/manifest)  │     │  课程/课时发现   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  提取层 (extract)│────▶│ 雨课堂接口      │
│ 获取幻灯片 URL  │     │ lesson-summary  │
└────────┬────────┘     │ presentation    │
         │              │ review (fallback)│
         ▼              └─────────────────┘
┌─────────────────┐
│  组织层 (organize)
│ 目录/元数据管理  │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐
│  下载层 (download)│───▶│ 图片 CDN        │
│ 并发下载图片     │     │ yuketang.cn     │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  笔记提取层      │────▶│  MiMo API       │
│ (extract-notes) │     │  mimo-v2.5      │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  总结层          │────▶│  MiMo API       │
│(summarize-course)│     │ mimo-v2.5-pro   │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│    review.md    │
└─────────────────┘
```

## 核心数据模型

### Lesson（课时）

```typescript
interface Lesson {
  lessonId: string;        // 雨课堂课时 ID
  activityId?: string;     // 课堂活动 ID，用于新版接口 Referer
  date: string;            // 课堂日期，ISO 8601
  title: string;           // 课时标题
  presentations: Presentation[];
  needsExtraction: boolean;
}
```

### Presentation（PPT）

```typescript
interface Presentation {
  presentationId: string;  // PPT ID
  title: string;           // PPT 标题
  images: string[];        // 幻灯片图片 URL，按页码顺序
}
```

### Manifest

```typescript
interface Manifest {
  version: string;
  courseName: string;
  classroomId?: string;
  cookies: Record<string, string>;
  headers?: Record<string, string>;
  lessons: Lesson[];
  needsDiscovery?: boolean;
  extractedAt?: string;
}
```

## LLM 总结流程

### 阶段 1：逐图提取

- 输入：课程目录下的所有 `.jpg` 图片。
- 模型：`mimo-v2.5`（性价比高，适合单图 OCR + 结构化）。
- 输出：每张图片对应一个 JSON 文件，包含 `title`、`bullets`、`formulas`、`keywords`、`concepts`、`summary`、`pageType`。
- 状态：`extracted/state.json` 记录每页处理状态，支持中断恢复。

### 阶段 2：去重总结

- 输入：所有提取出的结构化笔记。
- 模型：`mimo-v2.5-pro`（更强的综合能力，适合跨页面去重与主题聚类）。
- 输出：课程级 `review.md`，按章节组织，突出定义、定理、算法、例题和易错点。

## 接口策略

### 雨课堂接口

#### 新版接口（推荐）

1. `GET /api/v3/lesson-summary/student?lesson_id={lessonId}`
   - 返回该课时的所有 PPT 元数据 `presentations[]`。
   - 支持获取一次课中的多个 PPT。

2. `GET /api/v3/lesson-summary/student/presentation?presentation_id={pptId}&lesson_id={lessonId}`
   - 返回单个 PPT 的全部幻灯片 `slides[].cover`。
   - 包含未在课堂中展示过的页面。

#### 旧版接口（回退）

1. `GET /api/v3/classroom-report/student/review?lesson_id={lessonId}`
   - 返回课堂中实际展示过的幻灯片时间线。
   - 仅能获取展示过的页面，且无法区分同一课时内的多个 PPT。

2. `GET /api/v3/classroom-report/student/detail?lesson_id={lessonId}`
   - 获取课件总页数，用于输出「仅展示部分页面」的警告。

### MiMo 接口

- Base URL: `https://token-plan-cn.xiaomimimo.com/v1`
- 协议：OpenAI 兼容 API
- 推荐模型：`mimo-v2.5`（提取）、`mimo-v2.5-pro`（总结）

## 目录设计

- 课程目录：`downloads/{courseName}/`
- 课时目录：`downloads/{courseName}/{date}_{lessonId}_{title}/`
- 多 PPT 子目录：`downloads/{courseName}/{date}_{lessonId}_{title}/{序号}_{pptTitle}/`

目录命名经过 `sanitizeDirName` 处理，移除 Windows/Unix 非法字符。
