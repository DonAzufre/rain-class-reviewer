---
name: rain-class-reviewer
description: 通过 chrome-devtools-mcp 获取长江雨课堂登录 Cookie，然后调用本地脚本完成课程发现、PPT 下载、Markdown 笔记提取与复习大纲生成。当用户提到长江雨课堂、雨课堂、下载课件、生成复习大纲、课程总结、rain-class-reviewer 时触发。
whenToUse: 用户需要从长江雨课堂下载课件图片、按课时过滤下载，或生成/总结课程复习材料时
type: prompt
disableModelInvocation: false
---

# 长江雨课堂课件下载与复习大纲生成

## 重要：LLM 行为边界

本 Skill 严格区分 **浏览器 MCP** 与 **本地脚本** 的职责。你必须遵守以下边界，禁止越界操作。

### 你可以使用 chrome-devtools-mcp 做的事（仅限）

1. 打开 `https://changjiang.yuketang.cn/` 并检查登录状态。
2. 在用户未登录时，提示用户完成登录，并等待用户确认。
3. 登录后通过 `evaluate_script` 提取 `document.cookie` 中的 `sessionid`、`csrftoken`、`uv_id`、`university_id`、`xtbz`。
4. 处理脚本无法完成的复杂/模糊任务（如页面人机验证、需要用户在页面上手动点选的弹窗、浏览器独有的登录流程）。

### 禁止使用 chrome-devtools-mcp 做的事

- 调用课程列表、课时列表、PPT 提取等 API。
- 翻页、抓图、解析页面 HTML 来获取课程/课时/PPT 数据。
- 直接下载图片。
- 直接生成或修改复习大纲。
- 用浏览器反复探测接口正确性。

**这些任务必须调用 `scripts/bootstrap.js` 实现。** 具体接口清单见 `references/yuketang-api.md`。

### 最小 Manifest 构造后必须停止 MCP

一旦你通过 MCP 拿到 Cookie 并构造出最小 Manifest（包含 `version`、`courseName`、`cookies`），**立即停止所有 chrome-devtools-mcp 操作**。后续步骤必须交给脚本：

1. `node scripts/bootstrap.js verify-auth --manifest -` 校验登录态。
2. `node scripts/bootstrap.js --manifest - --json` 下载课件。
3. `node scripts/bootstrap.js summarize --course-dir "downloads/<课程名>" --force-summary` 提取笔记并生成复习大纲。

只有在脚本明确报告需要人工处理（如验证码、需要用户在浏览器里点选）时，才允许再次启用 MCP，且处理完后必须立刻回到脚本流程。

## 能力概述

- **自动登录态获取**：使用 chrome-devtools-mcp 连接浏览器，检查/等待用户登录后自动提取 Cookie。
- **脚本化后续流程**：登录态校验、课程发现、课时列表、PPT 下载、Markdown 笔记提取、复习大纲生成全部通过本地脚本完成。
- **过滤下载**：支持按日期、课时 ID、最新课时等条件下载。
- **Markdown 笔记**：每页 PPT 保存为独立 Markdown 文档，包含标题、要点、公式、关键词、核心概念和详细总结。
- **复习大纲**：跨页面整合生成 `review.md`。

## 前置条件

1. 已安装 Node.js（>= 18）和 npm。
2. 当前 Agent 环境支持 **chrome-devtools-mcp**。
3. 用户已明确指定要下载/总结的课程名。

## 快速开始

所有命令以本 Skill 目录为工作目录。首次调用时 `scripts/bootstrap.js` 会自动安装依赖。

### 完整流程

```text
1. 询问用户课程名（或关键词）。
2. 用 MCP 打开 https://changjiang.yuketang.cn/ 并获取 Cookie。
3. 构造最小 Manifest JSON。
4. 运行 node scripts/bootstrap.js verify-auth --manifest - 校验登录态。
5. 运行 node scripts/bootstrap.js list-courses --manifest - --json 获取课程列表。
6. 根据用户输入匹配课程；有歧义时向用户展示候选并确认 classroomId。
7. 构造带 classroomId 的 Manifest，运行 node scripts/bootstrap.js --manifest - --json 下载。
8. 运行 node scripts/bootstrap.js summarize --course-dir "downloads/<课程名>" --force-summary 生成复习大纲。
```

## 标准执行流程

### 1. 获取用户期望的课程名

向用户确认课程名，允许使用简称或关键词，例如“计算机网络”。记录用户原始输入，不要立即做任何匹配。

### 2. 使用 MCP 获取 Cookie

1. 连接浏览器。
2. 导航到 `https://changjiang.yuketang.cn/`。
3. 检查登录状态：
   - 通过 `evaluate_script` 读取 `document.cookie`，检查是否包含 `sessionid`。
   - 或检查页面 DOM 是否显示当前用户信息。
4. 若未登录：
   - 提示用户手动登录。
   - 等待用户回复“已登录”。
   - 刷新页面，重新检查。
5. 已登录后，从 `document.cookie` 解析：
   - `sessionid`
   - `csrftoken`
   - `uv_id`（通常为 `2874`）
   - `university_id`（通常为 `2874`）
   - `xtbz`（通常为 `ykt`）

### 3. 构造最小 Manifest

```json
{
  "version": "1.0",
  "courseName": "计算机网络",
  "cookies": {
    "sessionid": "...",
    "csrftoken": "...",
    "uv_id": "2874",
    "university_id": "2874",
    "xtbz": "ykt"
  }
}
```

`courseName` 使用用户原始输入。此 Manifest 只用于校验和获取课程列表，不保证最终匹配。**构造完此 Manifest 后，立即停止 MCP。**

### 4. 校验登录态

```bash
echo '<manifest-json>' | node scripts/bootstrap.js verify-auth --manifest -
```

- 成功：继续下一步。
- 失败：返回步骤 2，重新获取 Cookie。

### 5. 获取课程列表

```bash
echo '<manifest-json>' | node scripts/bootstrap.js list-courses --manifest - --json
```

返回当前账号下所有课程的 `classroomId`、`courseName`、`className`、`teacher`。

### 6. 匹配课程并处理歧义

用用户原始输入匹配课程列表：

- **唯一精确匹配**：直接使用该 `classroomId`。
- **无匹配**：向用户展示所有可用课程，要求用户指定课程名或 `classroomId`。
- **多个匹配**：向用户展示候选课程（含班级、教师、classroomId），要求用户确认。

**禁止擅自选择。** 确认后，构造新的 Manifest：

```json
{
  "version": "1.0",
  "courseName": "计算机网络",
  "classroomId": "13522533",
  "cookies": { ... }
}
```

### 7. 下载课件

```bash
echo '<manifest-with-classroomid>' | node scripts/bootstrap.js --manifest - --json
```

### 6. 提取 Markdown 笔记并生成复习大纲

```bash
node scripts/bootstrap.js summarize --course-dir "downloads/<课程名>" --force-summary
```

输出：

- 每页 Markdown 笔记：`downloads/<课程名>/extracted/<课时>/<页码>.md`
- 整体复习大纲：`downloads/<课程名>/review.md`

## 按课时过滤下载

只下载最新一次课时：

```bash
echo '<manifest-json>' | node scripts/bootstrap.js --manifest - --latest --json
```

按日期范围下载：

```bash
echo '<manifest-json>' | node scripts/bootstrap.js --manifest - --since 2023-11-01 --until 2023-11-05 --json
```

## 课程名歧义处理

- 若存在多个同名课程，脚本会报错并列出候选 `classroomId`。
- **禁止擅自选择**，必须向用户展示候选课程并要求确认。
- 确认后，在 Manifest 中显式指定 `classroomId` 再调用脚本。

## 认证失败处理

若脚本返回 403 / 未登录 / 认证校验失败：

1. 说明 `sessionid` 已过期或缺失。
2. 重新执行步骤 2（使用 MCP 检查/重新登录）。
3. 更新 Manifest 中的 Cookie。
4. 重新运行脚本。

## 安全与隐私

- **禁止在对话中明文输出完整 Cookie**。
- 优先通过 stdin 传递 Cookie 和 Manifest，不在磁盘上保存 `cookies.json`。
- 如果出于调试必须写临时文件，使用完毕后立即删除，或确保路径在 `.gitignore` 中。
- 下载目录 `downloads/` 和临时目录 `tmp/` 已在 `.gitignore` 中。

## 已知限制

- 工具优先使用新版 `lesson-summary` + `presentation` 接口获取完整 PPT；若不可用会自动回退到 `review` 接口，但后者只包含课堂中展示过的幻灯片。
- 总结功能依赖 MiMo API Key，需确保环境或 `tmp/mimo-apikey` 文件可用。

## 参考

- `references/yuketang-api.md`：长江雨课堂接口清单与约束。
- `references/manifest.example.json`：Manifest 完整示例。
- `docs/usage.md`：CLI 完整参数说明。
- `docs/implementation.md`：实现细节。
