# rain-class-reviewer

帮助用户从长江雨课堂（changjiang.yuketang.cn）下载指定课程的所有 PPT 图片，并可在二期生成复习材料。

## 能力边界

- **工具本身不连接浏览器**：工具接收课程名/Cookie 或 Manifest 后，通过雨课堂官方接口自动发现课程、课时，并获取幻灯片 URL 完成下载。
- **你负责浏览器交互**：通过 Chrome DevTools MCP 完成登录态检查、课程模糊匹配、Cookie 读取。你**不需要**再进入单次课堂详情页读取 iframe 图片 URL。

## 两种调用模式

### 模式 A：工具模式（由你或用户直接调用）

只提供课程名和 Cookie，工具全流程自动完成：

```bash
node src/index.js --course "工程伦理概论" --cookies ./cookies.json
```

工具会严格匹配课程名。如果名称不匹配或存在多个同名课程，工具会直接报错。

### 模式 B：Skill 模式（由你调用）

你通过浏览器完成登录态检查和课程模糊匹配，然后生成 Manifest 调用工具。

## 前置条件（硬性）

执行前必须同时满足：

1. 用户已启动 Chrome 并开启远程调试端口（如 `9222`）。
2. **用户已通过 Chrome 登录长江雨课堂**。
   - 若检测到未登录（页面跳转登录页或课程列表未出现），**必须立即停止并明确要求用户登录**，不得继续执行工具。
3. 用户给出了明确的自然语言指令，例如：
   - 「帮我下载日语课件」
   - 「帮我总结日语课程复习大纲」

## Skill 模式执行流程

### 1. 解析课程名

从用户指令中提取课程关键词。例如：

- 「帮我下载日语课件」→ 关键词为「日语」
- 「帮我总结日语课程复习大纲」→ 关键词为「日语」

### 2. 验证登录态

访问 `https://changjiang.yuketang.cn/v2/web/index`，检查页面是否出现课程列表。

- 若未登录：提示用户登录并终止。
- 若已登录：继续下一步。

### 3. 匹配课程（你负责模糊匹配）

使用 JavaScript 读取课程列表容器，提取 `{classroomId, title, teacher, className}`。

```javascript
const container = document.querySelector('.studentLog__view');
const fullText = container.innerText;
// 解析出课程列表
```

用关键词做模糊匹配：

- 若**唯一匹配**：直接使用该课程的 `classroomId`。
- 若**多个候选**：**必须列出候选课程并要求用户确认**，禁止擅自选择。
- 若**无匹配**：告知用户未找到课程并终止。

### 4. 提取 Cookies

读取 `changjiang.yuketang.cn` 域下必要 Cookie，**必须包含 `sessionid`**，同时建议携带：

- `csrftoken`
- `uv_id`
- `university_id`
- `xtbz`

这些 Cookie 用于工具调用雨课堂接口时维持登录态。

### 5. 生成 Manifest

按以下格式生成 Manifest JSON 文件。你**不需要**再提取课时 ID 或图片 URL：

```json
{
  "version": "1.0",
  "extractedAt": "2026-06-15T08:40:22.759Z",
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

如果你希望精确控制下载范围，也可以显式提供 `classroomId` 和 `lessons`：

```json
{
  "courseName": "工程伦理概论",
  "classroomId": "24932641",
  "cookies": { "sessionid": "..." },
  "lessons": [
    { "lessonId": "1704863264448235136", "date": "2026-06-10", "title": "..." }
  ]
}
```

### 6. 调用下载工具

```bash
node src/index.js --manifest /path/to/manifest.json --json
```

工具会：

1. （若未提供）调用课程列表接口 `GET /v2/api/web/courses/list?identity=2` 严格匹配课程名，获取 `classroomId`。
2. （若未提供）调用课堂记录接口 `GET /v2/api/web/logs/learn/{classroomId}?actype=-1&...`，按日期去重提取课时 `lessonId`。
3. 对每个课时调用 `GET /api/v3/classroom-report/student/review?lesson_id={lessonId}&front_time={timestamp}` 获取幻灯片 URL。
4. 并发下载到 `downloads/{courseName}/` 目录（可通过 `--output` 修改）。

### 7. 处理结果

- 若全部成功：报告保存目录与课时数。
- 若有失败：
  - **分析失败原因**。
  - 若失败原因为 403 / UNAUTHENTICATED，说明 `sessionid` 过期或缺失，返回浏览器重新读取 Cookie 并更新 Manifest。
  - 若为网络错误，建议用户重试。
  - **必须向用户清晰报告失败课时与具体原因**。

## 已知限制

雨课堂 `review` 接口只返回**课堂中实际展示过的幻灯片**，不是课件的全部页面。工具会在遇到这种情况时输出警告。如果用户要求完整课件，你需要：

1. 进入单次课堂详情页。
2. 在 iframe 中滚动加载全部幻灯片。
3. 读取所有 `img[src*="/slide/"]` 的 URL。
4. 将完整 `images` 数组填入 Manifest。

## 禁止行为

- 工具本身不得连接 Chrome DevTools Protocol。
- 不得将用户 Cookie 明文输出到对话中（可写入临时文件并在完成后删除）。
- 课程匹配存在歧义时不得擅自选择。

## 示例

### 示例 1：下载课件

用户：「帮我下载日语课件」

你的行为：

1. 检查登录态。
2. 模糊匹配「日语」课程，若唯一则继续；若多个则列出候选要求用户确认。
3. 读取 Cookie，生成最简 Manifest。
4. 调用工具。
5. 报告：`已下载 24 课时，保存至 downloads/25秋-26春研究生《日语》/`。

### 示例 2：生成复习大纲

用户：「帮我总结日语课程复习大纲」

你的行为：

1. 识别课程为「日语」。
2. 先完成下载流程。
3. 二期：调用 LLM（小米 MiMo Token Plan CN）对图片进行总结，生成 Markdown 复习大纲。

### 示例 3：认证失败重试

用户：「下载日语课件」→ 工具报告 UNAUTHENTICATED

你的行为：

1. 判断为 `sessionid` 过期或缺失。
2. 返回浏览器重新读取 `changjiang.yuketang.cn` 域下的 `sessionid`。
3. 更新 Manifest 中的 `cookies.sessionid`。
4. 重新调用工具。
5. 报告最终结果。
