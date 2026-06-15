# 使用指南

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

只需要课程名和 Cookie，工具会自动发现课程、课时并下载：

```bash
node src/index.js --course "工程伦理概论" --cookies ./cookies.json
```

`cookies.json` 示例：

```json
{
  "sessionid": "...",
  "csrftoken": "...",
  "uv_id": "...",
  "university_id": "...",
  "xtbz": "ykt"
}
```

### 模式二：Agent/Skill 模式（通过 Manifest）

Agent 通过 Chrome DevTools MCP 完成登录态检查、课程模糊匹配、Cookie 读取后生成 Manifest，再调用工具：

```bash
node src/index.js --manifest ./manifest.json
```

## CLI 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--manifest <path>` | Manifest 文件路径，`-` 表示从 stdin 读取 | 与 `--course` 二选一 |
| `--course <name>` | 工具模式：按课程名严格匹配 | 与 `--manifest` 二选一 |
| `--cookies <path>` | 工具模式：Cookie JSON 文件路径 | 工具模式必填 |
| `--output <dir>` | 输出根目录 | `downloads` |
| `--concurrency <n>` | 并发下载数 | 3 |
| `--retry <n>` | 单张图片失败重试次数 | 3 |
| `--force` | 强制重新下载已存在课时 | false |
| `--json` | 输出 JSON 结果 | false |

## 环境变量

所有 CLI 参数都支持通过环境变量设置：

- `RAIN_MANIFEST`
- `RAIN_COURSE`
- `RAIN_COOKIES`
- `RAIN_OUTPUT`
- `RAIN_CONCURRENCY`
- `RAIN_RETRY`

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

## 输出目录结构

默认输出到 `downloads/` 目录：

```
./
└── downloads/
    └── 工程伦理概论/
        ├── meta.json
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
