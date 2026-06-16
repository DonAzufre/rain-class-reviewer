---
name: rain-class-reviewer
description: 通过 chrome-devtools-mcp 自动登录长江雨课堂（changjiang.yuketang.cn），下载课程 PPT 图片并生成 Markdown 复习大纲。当用户提到长江雨课堂、雨课堂、下载课件、生成复习大纲、课程总结、rain-class-reviewer 时触发。
whenToUse: 用户需要从长江雨课堂下载课件图片、按课时过滤下载，或生成/总结课程复习材料时
type: prompt
disableModelInvocation: false
---

# 长江雨课堂课件下载与复习大纲生成

## 能力概述

本 Skill 通过浏览器 MCP 自动完成登录态获取，从长江雨课堂下载课程 PPT 图片，并调用 LLM 为每页 PPT 生成详细的 Markdown 笔记，最后整合成完整的 `review.md` 复习大纲。

- **自动登录态获取**：使用 chrome-devtools-mcp 连接浏览器，检查/等待用户登录后自动提取 Cookie。
- **下载**：自动发现课程、课时，下载所有 PPT 幻灯片。
- **过滤**：支持按日期、课时 ID、最新课时等条件下载。
- **Markdown 笔记**：每页 PPT 保存为独立的 Markdown 文档，包含标题、要点、公式、关键词、核心概念和详细总结。
- **复习大纲**：跨页面整合，生成一份信息密度高、结构化的 `review.md`。

## 前置条件

1. 已安装 Node.js（>= 18）和 npm。
2. 当前 Agent 环境支持 **chrome-devtools-mcp**（浏览器 DevTools 协议工具）。
3. 用户已明确指定要下载/总结的课程名。

## 快速开始

所有命令都以本 Skill 目录为工作目录执行。首次调用时 `scripts/bootstrap.js` 会自动安装依赖。

### 查看帮助

```bash
node scripts/bootstrap.js --help
```

### 完整流程示例

```bash
# 1. 通过 chrome-devtools-mcp 获取 Cookie 并构造 Manifest 后，直接下载
node scripts/bootstrap.js --course "工程伦理概论" --cookies '{"sessionid":"...","csrftoken":"...","uv_id":"2874","university_id":"2874","xtbz":"ykt"}' --json

# 2. 生成每页 Markdown 笔记和复习大纲
node scripts/bootstrap.js summarize --course-dir "downloads/工程伦理概论" --force-summary
```

更推荐通过 stdin 传入完整 Manifest，避免在命令行里写 Cookie：

```bash
cat <<'EOF' | node scripts/bootstrap.js --manifest - --json
{
  "version": "1.0",
  "courseName": "工程伦理概论",
  "cookies": { "sessionid": "...", "csrftoken": "...", "uv_id": "2874", "university_id": "2874", "xtbz": "ykt" }
}
EOF
```

## 标准执行流程

### 1. 打开浏览器并检查登录状态

使用 chrome-devtools-mcp 执行以下操作：

1. 连接浏览器。
2. 导航到 `https://changjiang.yuketang.cn/`。
3. 通过 `evaluate_script` 检查 `document.cookie` 是否包含有效 `sessionid`，或页面 DOM 是否显示当前用户信息。

### 2. 处理登录

- **已登录**：继续下一步。
- **未登录**：
  1. 提示用户：“请手动登录长江雨课堂，完成后告诉我”。
  2. 等待用户确认已登录。
  3. 刷新页面，重新检查登录状态。

### 3. 自动提取 Cookie

登录确认后，通过 `evaluate_script` 获取 `document.cookie`，并解析出：

- `sessionid`
- `csrftoken`
- `uv_id`（通常为 `2874`）
- `university_id`（通常为 `2874`）
- `xtbz`（通常为 `ykt`）

构造最小 Manifest：

```json
{
  "version": "1.0",
  "courseName": "用户指定的课程名",
  "cookies": {
    "sessionid": "...",
    "csrftoken": "...",
    "uv_id": "2874",
    "university_id": "2874",
    "xtbz": "ykt"
  }
}
```

### 4. 发现课程并下载

通过 stdin 把 Manifest 传给 CLI：

```bash
echo '<manifest-json>' | node scripts/bootstrap.js --manifest - --json
```

如果存在同名课程歧义，CLI 会列出候选 `classroomId`。**禁止擅自选择**，必须向用户展示候选课程并要求确认，然后在 Manifest 中显式添加 `classroomId` 后重试。

### 5. 提取每页 Markdown 笔记并生成复习大纲

```bash
node scripts/bootstrap.js summarize --course-dir "downloads/<课程名>" --force-summary
```

输出：

- 每页 Markdown 笔记：`downloads/<课程名>/extracted/<课时>/<页码>.md`
- 整体复习大纲：`downloads/<课程名>/review.md`

## 按课时过滤下载

只下载最新一次课时：

```bash
node scripts/bootstrap.js --course "工程伦理概论" --cookies '<cookie-json>' --latest --json
```

按日期范围下载：

```bash
node scripts/bootstrap.js --course "计算机网络" --cookies '<cookie-json>' --since 2023-11-01 --until 2023-11-05 --json
```

## 课程名歧义处理

- 若存在多个同名课程，工具会报错并列出候选 `classroomId`。
- **禁止擅自选择**，必须向用户展示候选课程并要求确认。
- 确认后，在 Manifest 中显式指定 `classroomId` 再调用。

## 认证失败处理

若工具返回 403 / UNAUTHENTICATED：

1. 说明 `sessionid` 已过期或缺失。
2. 重新执行“打开浏览器并检查登录状态”步骤。
3. 更新 Manifest 中的 Cookie。
4. 重新调用工具。

## 安全与隐私

- **禁止在对话中明文输出完整 Cookie**。
- 优先通过 stdin 或环境变量传递 Cookie，不在磁盘上保存 `cookies.json`。
- 如果出于调试必须写临时文件，使用完毕后立即删除，或确保路径在 `.gitignore` 中。
- 下载目录 `downloads/` 和临时目录 `tmp/` 已在 `.gitignore` 中。

## 已知限制

- 工具优先使用新版 `lesson-summary` + `presentation` 接口获取完整 PPT；若不可用会自动回退到 `review` 接口，但后者只包含课堂中展示过的幻灯片。
- 总结功能依赖 MiMo API Key，需确保环境或 `tmp/mimo-apikey` 文件可用。

## 参考

- `references/manifest.example.json`：Manifest 完整示例。
- `docs/usage.md`：CLI 完整参数说明。
- `docs/implementation.md`：实现细节。
