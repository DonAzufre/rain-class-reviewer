# rain-class-reviewer

从长江雨课堂下载课程 PPT 图片并生成复习材料的工具。

## 设计原则

- **工具本身不连接浏览器**：仅接收课程名/Cookie 或 Agent 提取的 Manifest，然后调用雨课堂官方接口获取幻灯片 URL 并完成下载。
- **Agent/Skill 负责浏览器交互**：登录态检查、课程模糊匹配、Cookie 读取、token 失效重试都由 Skill 约束 Agent 完成。

## 安装

```bash
npm install
```

或直接运行（Node.js ≥ 18）：

```bash
node src/index.js --manifest ./manifest.json
```

## 使用方式

### 模式一：工具模式（直接给定课程名）

只需要课程名和 Cookie，工具会自动：

1. 查询你的课程列表，按名称**严格匹配**课程。
2. 查询该课程的课堂记录，提取所有课时 `lessonId`。
3. 调用 `review` 接口获取每节课的幻灯片 URL。
4. 并发下载。

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

Agent 通过 Chrome DevTools MCP 完成以下步骤：

1. 确认用户已登录 `https://changjiang.yuketang.cn`。
2. 从用户指令中提取课程名，做模糊匹配并处理歧义。
3. 读取当前页面的 Cookie（**必须包含 `sessionid`**），生成 Manifest。

Manifest 可以只包含 `courseName` 和 `cookies`，由工具自动发现 `classroomId` 和 `lessons`；也可以显式提供 `classroomId` + `lessons`。

```bash
node src/index.js --manifest ./manifest.json
```

### CLI 参数

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

### 环境变量

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

### 兼容格式（直接提供图片 URL）

如果你已经从浏览器中提取了完整的图片 URL，也可以直接提供 `images` 数组，工具会跳过接口提取：

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
        └── ...
```

## Skill 使用

将 `skill/rain-class-reviewer/` 复制到你的 `.kimi-code/skills/` 目录下即可被 Agent 识别：

```bash
cp -r skill/rain-class-reviewer ~/.kimi-code/skills/
```

Agent 会根据 `SKILL.md` 中的约束完成浏览器交互。Skill 模式下：

- **课程名模糊匹配** 由 Agent 负责，存在歧义时必须询问用户。
- 生成 Manifest 后调用工具，工具通过接口完成后续所有步骤。

## 已知限制

雨课堂 `review` 接口只返回**课堂中实际展示过的幻灯片**。例如某课件共 165 页，但一节课只展示了 101 页，工具只会下载这 101 页，并输出警告。如需完整课件，请让 Agent 在浏览器中滚动加载全部幻灯片后提供 `images` 数组。

## 二期：LLM 总结

计划接入小米 MiMo Token Plan CN（OpenAI 兼容协议）：

- Base URL: `https://token-plan-cn.xiaomimimo.com/v1`
- API Key: `tp-xxxxx`
- 模型: `mimo-v2.5` / `mimo-v2.5-pro`

命令预览：

```bash
node src/index.js summarize --course-dir "./工程伦理概论" --model mimo-v2.5
```
