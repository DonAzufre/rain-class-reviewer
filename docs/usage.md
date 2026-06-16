# 使用指南

> 接口清单与约束：`references/yuketang-api.md`  
> Cookie 提取细节：`SKILL.md`（优先从 DevTools Network 请求头读取，支持 HttpOnly Cookie）

## 安装

```bash
npm install
```

或直接运行（Node.js ≥ 18）：

```bash
node src/index.js --manifest ./manifest.json
```

## 调用模式

### 模式一：工具模式（直接给定课程名）

只需要课程名和 Cookie，工具会自动发现课程、课时并下载。Cookie 可以是文件路径或 JSON 字符串：

```bash
# Cookie 文件
node src/index.js --course "工程伦理概论" --cookies ./cookies.json

# Cookie JSON 字符串
node src/index.js --course "工程伦理概论" --cookies '{"sessionid":"...","csrftoken":"...","uv_id":"0","university_id":"0","xtbz":"ykt"}'

# 直接指定 classroomId（跳过课程名匹配）
node src/index.js --course "工程伦理概论" --classroom-id "13522533" --cookies ./cookies.json
```

`cookies.json` 示例：

```json
{
  "sessionid": "...",
  "csrftoken": "...",
  "uv_id": "0",
  "university_id": "0",
  "xtbz": "ykt"
}
```

### 模式二：Agent/Skill 模式（通过 Manifest）

Agent 通过 Chrome DevTools MCP 完成登录态检查、Cookie 读取后生成 Manifest，再调用工具。在 Skill 工作流中，Manifest 应写入 Skill 目录下的 `tmp/manifest.json`（覆盖），并通过路径引用：

```bash
node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --output rain-class-reviewer-downloads --json
```

**约束**：MCP 仅用于获取 Cookie 和处理复杂/模糊场景；构造 Manifest 后必须停止 MCP，后续由脚本完成。完整接口清单见 `references/yuketang-api.md`。

## CLI 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--manifest <path>` | Manifest 文件路径，`-` 表示从 stdin 读取 | 与 `--course` 二选一 |
| `--course <name>` | 工具模式：按课程名严格匹配 | 与 `--manifest` 二选一 |
| `--classroom-id <id>` | 工具模式：直接指定 classroomId（可配合 `--course` 使用） | - |
| `--cookies <path\|json>` | 工具模式：Cookie JSON 文件路径或直接传入 JSON 字符串 | 工具模式必填 |
| `--output <dir>` | 输出根目录 | `rain-class-reviewer-downloads` |
| `--concurrency <n>` | 并发下载数 | 3 |
| `--extract-concurrency <n>` | 图像提取并发数 | 2 |
| `--retry <n>` | 单张图片失败重试次数 | 3 |
| `--force` | 强制重新下载已存在课时 | false |
| `--json` | 输出 JSON 结果 | false |
| `--since <date>` | 只下载该日期及之后的课时 | - |
| `--until <date>` | 只下载该日期及之前的课时 | - |
| `--latest` | 只下载最新一次课时 | false |
| `--lesson-id <id>` | 只下载指定 lessonId（可多次使用） | - |
| `--lesson-date <date>` | 只下载指定日期的课时（可多次使用） | - |

## 指定课时下载

无论是工具模式还是 Manifest 模式，都可以在下载阶段过滤课时：

```bash
# 只下载最新一次课
node src/index.js --course "工程伦理概论" --cookies ./cookies.json --latest

# 下载 2026-06-01 之后的所有课
node src/index.js --course "工程伦理概论" --cookies ./cookies.json --since 2026-06-01

# 下载 2026-05-01 到 2026-06-10 之间的课
node src/index.js --course "工程伦理概论" --cookies ./cookies.json \
  --since 2026-05-01 --until 2026-06-10

# 下载指定 lessonId 的课（可多次使用 --lesson-id）
node src/index.js --course "工程伦理概论" --cookies ./cookies.json \
  --lesson-id 1704863264448235136 \
  --lesson-id 1699795924878665984

# 下载指定日期的课（可多次使用 --lesson-date）
node src/index.js --course "工程伦理概论" --cookies ./cookies.json \
  --lesson-date 2026-06-10

# Manifest 模式同样支持过滤
node src/index.js --manifest ./manifest.json --latest
```

过滤规则：

- `--latest` 优先级最高，仅保留日期最新的一次课时。
- `--since` / `--until` 按 `YYYY-MM-DD` 日期范围过滤。
- `--lesson-id` 按 lessonId 精确匹配，可多次指定。
- `--lesson-date` 按日期精确匹配，可多次指定。
- 多个过滤条件同时存在时取交集。

## 环境变量

所有 CLI 参数都支持通过环境变量设置：

- `RAIN_MANIFEST`
- `RAIN_COURSE`
- `RAIN_CLASSROOM_ID`
- `RAIN_COOKIES`
- `RAIN_OUTPUT`
- `RAIN_CONCURRENCY`
- `RAIN_RETRY`
- `RAIN_SINCE`
- `RAIN_UNTIL`
- `RAIN_LATEST`
- `RAIN_LESSON_ID`（逗号分隔多个 ID）
- `RAIN_LESSON_DATE`（逗号分隔多个日期）
- `MIMO_TP_API_KEY`（优先级最高，直接传入 MiMo key）

## Manifest 格式

### 最简格式（自动发现）

```json
{
  "version": "1.0",
  "courseName": "工程伦理概论",
  "cookies": {
    "sessionid": "...",
    "csrftoken": "...",
    "uv_id": "...",
    "university_id": "...",
    "xtbz": "ykt"
  },
  "headers": {
    "User-Agent": "..."
  }
}
```

### 显式提供课时

```json
{
  "version": "1.0",
  "courseName": "25秋-26春研究生《日语》",
  "classroomId": "22928774",
  "cookies": { "sessionid": "..." },
  "headers": { "User-Agent": "..." },
  "lessons": [
    {
      "lessonId": "12345678",
      "date": "2025-10-21",
      "title": "课程简介、日语文字、五十音图a-ka"
    }
  ]
}
```

### 直接提供图片 URL（兼容旧格式）

如果你已经从浏览器中提取了完整的图片 URL，可以提供 `images` 数组，工具会跳过接口提取：

```json
{
  "lessons": [
    {
      "lessonId": "12345678",
      "images": [
        "https://changjiang-private-qn.yuketang.cn/slide/39717931/cover23567_20260609152755.jpg?e=1781444297&token=..."
      ]
    }
  ]
}
```

也支持 `slideManifest` 结构，工具会自动拼接 URL。

### 多 PPT 格式

如果一次课堂活动包含多个 PPT，可以提供 `presentations` 数组：

```json
{
  "lessons": [
    {
      "lessonId": "1318590613705012608",
      "date": "2024-12-24",
      "title": "5.2 贪心法正确性证明（2）",
      "presentations": [
        {
          "presentationId": "1318590613705012609",
          "title": "5.2 贪心法正确性证明",
          "images": ["..."]
        },
        {
          "presentationId": "1318590613705012610",
          "title": "《算法设计与分析》说课",
          "images": ["..."]
        }
      ]
    }
  ]
}
```

## 校验登录态

在下载前验证 Cookie 是否有效：

```bash
node src/index.js verify-auth --manifest ./manifest.json
```

成功输出：

```text
认证有效，已发现 X 门课程
```

失败输出明确的认证错误，此时应重新获取 Cookie。

## 列出课程

获取当前账号下的所有课程，用于匹配/消歧：

```bash
node src/index.js list-courses --manifest ./manifest.json --json
```

JSON 输出示例：

```json
{
  "ok": true,
  "courses": [
    { "classroomId": "13522533", "courseName": "计算机网络", "className": "21计算机类地方本科班", "teacher": "杨翔瑞" },
    { "classroomId": "14737547", "courseName": "计算机网络", "className": "2023秋季无J籍", "teacher": "蔡开裕" }
  ]
}
```

Agent/Skill 流程中，先 `list-courses` 再匹配用户输入；若存在同名课程歧义，必须向用户展示候选并确认 `classroomId`。

## 总结模式

下载完成后，可以对课程图片进行 LLM 识别、信息提取和去重总结：

```bash
node src/index.js summarize --course-dir "rain-class-reviewer-downloads/算法设计与分析"
```

常用参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `summarize` | 子命令，进入总结模式 | - |
| `verify-auth` | 子命令，校验登录态 | - |
| `list-courses` | 子命令，列出当前账号课程 | - |
| `--course-dir <dir>` | 已下载课程的目录路径 | `RAIN_COURSE_DIR` |
| `--lesson-dir <dir>` | 只总结课程下的某一课时目录 | `RAIN_LESSON_DIR` |
| `--model <name>` | 总结模型 | `mimo-v2.5-pro` |
| `--extract-model <name>` | 图像提取模型 | `mimo-v2.5` |
| `--extract-concurrency <n>` | 图像提取并发数，遇到 429 可适当降低 | 2 |
| `--api-key <path\|key>` | MiMo API Key 文件路径或直接传入 key。优先使用 `MIMO_TP_API_KEY` 环境变量 | `tmp/mimo-apikey` |
| `--force-summary` | 强制重新生成 `review.md` | false |

示例：

```bash
# 总结整门课程
node src/index.js summarize --course-dir "rain-class-reviewer-downloads/算法设计与分析"

# 只总结某一节课
node src/index.js summarize \
  --course-dir "rain-class-reviewer-downloads/算法设计与分析" \
  --lesson-dir "rain-class-reviewer-downloads/算法设计与分析/2024-12-24_1318590613705012608_5.2 贪心法正确性证明（2）"

# 指定模型、降低并发避免限流
node src/index.js summarize \
  --course-dir "rain-class-reviewer-downloads/算法设计与分析" \
  --model mimo-v2.5-pro \
  --extract-model mimo-v2.5 \
  --extract-concurrency 1 \
  --api-key ./my-mimo-key.txt

# 强制重新提取并总结
node src/index.js summarize --course-dir "rain-class-reviewer-downloads/算法设计与分析" --force-summary
```

总结流程：

1. 扫描 `--course-dir` 下的所有 `.jpg` 图片。
2. 调用 `--extract-model` 逐页提取文字、公式、概念等结构化信息，保存为 `{courseDir}/extracted/.../<页码>.md` Markdown 文档。
3. 调用 `--model` 汇总所有 Markdown 笔记，去重并生成 `review.md`。
4. 已提取页面会记录状态，中断后重新运行会自动跳过。

## 输出目录结构

默认输出到 `rain-class-reviewer-downloads/` 目录：

```
./
└── rain-class-reviewer-downloads/
    └── 算法设计与分析/
        ├── meta.json
        ├── review.md                      # 课程复习大纲
        ├── extracted/                     # LLM 提取的 Markdown 笔记
        │   ├── state.json
        │   ├── 2024-12-24_1318590613705012608_5.2 贪心法正确性证明（2）/
        │   │   ├── 001_5.2 贪心法正确性证明/
        │   │   │   ├── 001.md
        │   │   │   └── ...
        │   │   └── 002_《算法设计与分析》说课/
        │   │       ├── 001.md
        │   │       └── ...
        │   └── ...
        ├── 2026-06-10_1704863264448235136_电子信息领域中的伦理问题（2）/
        │   ├── meta.json
        │   ├── 001.jpg
        │   ├── 002.jpg
        │   └── ...
        └── 2024-12-24_1318590613705012608_5.2 贪心法正确性证明（2）/
            ├── meta.json
            ├── 001_5.2 贪心法正确性证明/
            │   ├── 001.jpg
            │   └── ...
            └── 002_《算法设计与分析》说课/
                ├── 001.jpg
                └── ...
```

规则：

- 单 PPT 课时：图片直接放在课时目录下。
- 多 PPT 课时：每个 PPT 单独创建一个子目录 `序号_PPT标题/`。
- 同一天多次课堂活动：每个活动独立生成一个课时目录，不再按日期去重合并。
