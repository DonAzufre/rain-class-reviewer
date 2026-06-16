---
name: rain-class-reviewer
description: 通过 chrome-devtools-mcp 获取长江雨课堂登录 Cookie（包括 HttpOnly Cookie），然后调用本地脚本完成课程发现、PPT 下载、Markdown 笔记提取与复习大纲生成。当用户提到长江雨课堂、雨课堂、下载课件、生成复习大纲、课程总结、rain-class-reviewer 时触发。
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
3. 登录后获取 Cookie：
   - 优先通过 **DevTools Network 请求头**读取 `Cookie` 字段（可获取包括 HttpOnly 在内的所有 Cookie）。
   - 若请求头中无法获取，可回退到读取非 HttpOnly 的 `document.cookie`。
   - 处理脚本无法完成的复杂/模糊任务（如页面人机验证、需要用户在页面上手动点选的弹窗、浏览器独有的登录流程）。
4. 处理脚本无法完成的复杂/模糊任务（如页面人机验证、需要用户在页面上手动点选的弹窗、浏览器独有的登录流程）。

### 禁止使用 chrome-devtools-mcp 做的事

- 调用课程列表、课时列表、PPT 提取等 API 并读取响应数据来获取业务信息。
- 翻页、抓图、解析页面 HTML 来获取课程/课时/PPT 数据。
- 直接下载图片。
- 直接生成或修改复习大纲。
- 用浏览器反复探测接口正确性。

**这些任务必须调用 `scripts/bootstrap.js` 实现。** 具体接口清单见 `references/yuketang-api.md`。

> **关键区别**：用 MCP 读取网络请求的 `Cookie` **请求头**属于“获取登录态”，是允许的；用 MCP 读取 API 响应体属于“获取业务数据”，是禁止的。

### 最小 Manifest 构造后必须停止 MCP

一旦你通过 MCP 拿到 Cookie，**立即停止所有 chrome-devtools-mcp 操作**。Cookie 只能通过 `RAIN_COOKIES` 环境变量传给脚本，Manifest 文件只保留课程信息。后续步骤必须交给脚本：

```bash
set RAIN_COOKIES={"sessionid":"...","csrftoken":"...","uv_id":"0","university_id":"0","xtbz":"ykt"}
```

1. `node <skill-path>/scripts/bootstrap.js verify-auth --manifest <skill-path>/tmp/manifest.json` 校验登录态。
2. `node <skill-path>/scripts/bootstrap.js list-courses --manifest <skill-path>/tmp/manifest.json --json` 获取课程列表。
3. `node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --json` 下载课件（默认输出到项目根目录的 `rain-class-reviewer-downloads/`）。
4. `node <skill-path>/scripts/bootstrap.js summarize --course-dir "rain-class-reviewer-downloads/<课程名>" --force-summary` 提取笔记并生成复习大纲。

> 为兼容 Claude Code auto mode 的安全策略，**不要把 Manifest 通过 stdin 传入，也不要在 Manifest 文件中写 Cookie**。把最终 Manifest 写入 Skill 目录下的 `tmp/manifest.json`（覆盖写入），并在命令中通过路径引用；Cookie 通过 `RAIN_COOKIES` 环境变量传入。`tmp/` 已在 `.gitignore` 中，不会进入版本控制。

只有在脚本明确报告需要人工处理（如验证码、需要用户在浏览器里点选）时，才允许再次启用 MCP，且处理完后必须立刻回到脚本流程。

## 能力概述

- **自动登录态获取**：使用 chrome-devtools-mcp 连接浏览器，检查/等待用户登录后自动提取 Cookie（支持 HttpOnly Cookie）。
- **脚本化后续流程**：登录态校验、课程发现、课时列表、PPT 下载、Markdown 笔记提取、复习大纲生成全部通过本地脚本完成。
- **过滤下载**：支持按日期、课时 ID、最新课时等条件下载。
- **Markdown 笔记**：每页 PPT 保存为独立 Markdown 文档，包含标题、要点、公式、关键词、核心概念和详细总结。
- **复习大纲**：跨页面整合生成 `review.md`。

## 前置条件

开始执行前，必须依次完成以下显式检查：

1. **检查 Node.js 和 npm**
   - 运行 `node -v`，确认主版本号 >= 18。
   - 运行 `npm -v`，确认 npm 可用。
   - 任一不满足时，停止并提示用户安装 Node.js >= 18。

2. **检查 chrome-devtools-mcp**
   - 尝试调用一次 MCP 浏览器工具（例如 `mcp__chrome-devtools__list_pages` 或 `mcp__chrome-devtools__navigate_page`）。
   - 如果 MCP 不可用，停止并提示用户确认 Claude Code / OpenCode 已启用 chrome-devtools-mcp。

3. **检查总结所需 API Key（仅在用户要求生成复习大纲时）**
   - 检查环境变量 `MIMO_TP_API_KEY` 是否存在且以 `tp-` 开头。
   - 如果已存在，继续执行。
   - 如果不存在，**向用户询问 MiMo API Key**（以 `tp-` 开头）。
   - 获得用户提供的 Key 后，在后续所有涉及总结的命令中通过环境变量传入，例如：
     ```bash
     set MIMO_TP_API_KEY=tp-xxxx
     node .claude/skills/rain-class-reviewer/scripts/bootstrap.js summarize --course-dir rain-class-reviewer-downloads/<课程名>
     ```
   - **禁止**要求用户把 Key 写入文件，也禁止 Skill 把 Key 写入磁盘。

4. **确认用户已明确指定要下载/总结的课程名。**

## 快速开始

**所有命令应在当前 Claude Code / OpenCode 项目根目录执行**，通过 Skill 目录的相对路径调用脚本。`scripts/bootstrap.js` 会自动把项目根目录当作工作目录，因此：

- 相对路径的 `--manifest`、`-o`、`--course-dir`、`--lesson-dir` 等参数都以项目根目录为基准解析，不会出现路径重复。
- 不指定 `--output` 时，默认下载目录会生成在项目根目录的 `rain-class-reviewer-downloads/` 下，而不是 Skill 安装目录下。

首次调用时 `scripts/bootstrap.js` 会优先使用预构建的 `dist/cli.cjs`（已包含 `openai` 等依赖），无需联网安装；若不存在才会自动 `npm install`。

### 完整流程

```text
1. 询问用户课程名（或关键词）。
2. 用 MCP 打开 https://changjiang.yuketang.cn/ 并获取 Cookie（优先从 Network 请求头读取）。
3. 构造最小 Manifest JSON，写入 <skill-path>/tmp/manifest.json。
4. 运行 node <skill-path>/scripts/bootstrap.js verify-auth --manifest <skill-path>/tmp/manifest.json 校验登录态。
5. 运行 node <skill-path>/scripts/bootstrap.js list-courses --manifest <skill-path>/tmp/manifest.json --json 获取课程列表。
6. 根据用户输入匹配课程；有歧义时向用户展示候选并确认 classroomId。
7. 使用课程列表返回的原始 courseName，构造带 classroomId 的 Manifest（覆盖 tmp/manifest.json），运行 node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --json 下载（默认输出到 rain-class-reviewer-downloads/）。
8. 设置 `MIMO_TP_API_KEY` 后，运行 `node <skill-path>/scripts/bootstrap.js summarize --course-dir "rain-class-reviewer-downloads/<原始课程名>" --force-summary` 生成复习大纲。
```

示例（Claude Code 项目级 Skill 路径为 `.claude/skills/rain-class-reviewer`）：

```bash
node .claude/skills/rain-class-reviewer/scripts/bootstrap.js \
  --manifest .claude/skills/rain-class-reviewer/tmp/manifest.json --json
```

## 标准执行流程

### 1. 获取用户期望的课程名

向用户确认课程名，允许使用简称或关键词，例如“计算机网络”。记录用户原始输入，不要立即做任何匹配。

### 2. 使用 MCP 获取 Cookie

长江雨课堂的 `sessionid` 通常是 **HttpOnly Cookie**，无法通过 `document.cookie` 读取。你必须通过 **Chrome DevTools Network 请求头**获取，且必须严格使用下面列出的 URL。

#### 2.1 打开长江雨课堂页面

**必须导航到的 URL**：

```text
https://changjiang.yuketang.cn/
```

操作步骤：

1. 连接浏览器。
2. 使用 `mcp__chrome-devtools__navigate_page` 导航到：
   ```text
   https://changjiang.yuketang.cn/
   ```
3. 如果页面已经加载过，使用 `type=reload` 刷新同一 URL，以产生新的网络请求：
   ```text
   mcp__chrome-devtools__navigate_page: type=reload, url=https://changjiang.yuketang.cn/
   ```

#### 2.2 触发一条带 Cookie 的网络请求

刷新页面后，浏览器通常会自动产生多个带 Cookie 的请求。如果没有出现足够的请求，**必须**主动触发下列 URL：

**首选触发 URL**（该 URL 与脚本后续 `verify-auth` / `list-courses` 使用的课程列表接口完全一致，安全且可复用）：

```text
GET https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2
```

触发方式（任选其一，**仅用于产生请求流量，禁止读取响应业务数据**）：

- 方式 A：执行一次页面刷新（见 2.1）。
- 方式 B：通过 `evaluate_script` 执行：
  ```javascript
  fetch('https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2', { credentials: 'include' });
  ```

**备用触发 URL**（当首选请求未出现时，任何发往 `changjiang.yuketang.cn` 的请求均可）：

```text
https://changjiang.yuketang.cn/            （页面文档）
https://changjiang.yuketang.cn/v2/web/index （首页入口）
https://changjiang.yuketang.cn/*           （同域名下的静态资源，如 JS/CSS）
```

> **禁止**使用其他雨课堂子域名或第三方接口来探测 Cookie。

#### 2.3 从 Network 请求头中读取 Cookie

1. 调用 `list_network_requests` 查看最近的请求。
2. 在请求列表中按以下优先级选择一条请求：
   - **优先**：`https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2`
   - **次选**：`https://changjiang.yuketang.cn/` 或 `https://changjiang.yuketang.cn/v2/web/index`
   - **可接受**：任何 `https://changjiang.yuketang.cn/*` 请求
3. 使用 `get_network_request` 读取该请求的 **Request Headers**。
4. 在请求头中找到 `cookie` 或 `Cookie` 字段，解析以下字段：
   - `sessionid`（必须）
   - `csrftoken`（建议携带，用于 CSRF 校验）
   - `uv_id`（按实际值提取，可能是 `0` 或其他值）
   - `university_id`（按实际值提取，可能与 `uv_id` 相同或不同）
   - `xtbz`（通常为 `ykt`）
   - `django_language`（可选）

示例 Cookie 头：

```text
sessionid=abc123; csrftoken=xyz789; uv_id=0; university_id=0; xtbz=ykt
```

> 不要硬编码 `uv_id=2874` 或 `university_id=2874`，必须从请求头中读取实际值。缺失或 `0` 都是允许的。

#### 2.4 处理未登录情况

- 如果请求头中没有 `sessionid`，或请求被重定向到登录页，说明用户未登录。
- 提示用户手动登录长江雨课堂。
- 等待用户回复“已登录”。
- 刷新页面或再次触发 `https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2`，重新读取 Cookie。

#### 2.5 回退方案

如果 MCP 无法提供请求头中的 Cookie：

1. 尝试读取 `document.cookie` 获取非 HttpOnly Cookie（通常至少能拿到 `csrftoken`）。
2. 如果仍无法拿到 `sessionid`，请用户手动提供 `sessionid`，或检查 MCP 是否支持获取 HttpOnly Cookie。
3. **无论回退是否成功，最终仍然必须通过 Network 请求头拿到 `sessionid`**。

### 3. 构造最小 Manifest

```json
{
  "version": "1.0",
  "courseName": "计算机网络"
}
```

`courseName` 使用用户原始输入。此 Manifest 只用于校验和获取课程列表，不保证最终匹配。**构造完此 Manifest 后，立即停止 MCP。**

Cookie 通过 `RAIN_COOKIES` 环境变量传入（下同）：

```bash
set RAIN_COOKIES={"sessionid":"...","csrftoken":"...","uv_id":"0","university_id":"0","xtbz":"ykt"}
```

### 4. 校验登录态

```bash
set RAIN_COOKIES={...}
node <skill-path>/scripts/bootstrap.js verify-auth --manifest <skill-path>/tmp/manifest.json
```

- 成功：继续下一步。
- 失败：返回步骤 2，重新获取 Cookie。

### 5. 获取课程列表

```bash
set RAIN_COOKIES={...}
node <skill-path>/scripts/bootstrap.js list-courses --manifest <skill-path>/tmp/manifest.json --json
```

返回当前账号下所有课程的 `classroomId`、`courseName`、`className`、`teacher`。

### 6. 匹配课程并处理歧义

用用户原始输入匹配课程列表：

- **唯一精确匹配**：直接使用该 `classroomId`。
- **无匹配**：向用户展示所有可用课程，要求用户指定课程名或 `classroomId`。
- **多个匹配**：向用户展示候选课程（含班级、教师、classroomId），要求用户确认。

**禁止擅自选择。** 确认后，使用课程列表返回的**原始 `courseName`** 构造新的 Manifest，并覆盖写入 `tmp/manifest.json`：

```json
{
  "version": "1.0",
  "courseName": "计算机网络",
  "classroomId": "13522533"
}
```

### 7. 下载课件

```bash
set RAIN_COOKIES={...}
node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --json
```

### 8. 提取 Markdown 笔记并生成复习大纲

```bash
set MIMO_TP_API_KEY=tp-xxxx
node <skill-path>/scripts/bootstrap.js summarize --course-dir "rain-class-reviewer-downloads/<课程名>" --force-summary
```

输出：

- 每页 Markdown 笔记：`rain-class-reviewer-downloads/<课程名>/extracted/<课时>/<页码>.md`
- 整体复习大纲：`rain-class-reviewer-downloads/<课程名>/review.md`

## 按课时过滤下载

只下载最新一次课时：

```bash
node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --latest --json
```

按日期范围下载：

```bash
node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --since 2023-11-01 --until 2023-11-05 --json
```

## 课程名歧义处理

- 若存在多个同名课程，脚本会报错并列出候选 `classroomId`。
- **禁止擅自选择**，必须向用户展示候选课程并要求确认。
- 确认后，在 Manifest 中显式指定 `classroomId` 再调用脚本。

## 认证失败处理

若脚本返回 403 / 未登录 / 认证校验失败：

1. 说明 `sessionid` 已过期或缺失。
2. 重新执行步骤 2（使用 MCP 检查/重新登录）。
3. 更新 `RAIN_COOKIES` 环境变量。
4. 重新运行脚本。

## Claude Code 自动模式特别说明

本 Skill 的 Manifest 文件**不再包含 Cookie 等凭据**；Cookie 只能通过 `RAIN_COOKIES` 环境变量传递。因此 `Write(tmp/manifest.json)` 只写入课程名/classroomId，通常可以通过 auto mode 的文件写入检查。

如果 auto mode 仍然拦截写入临时文件，可在当前项目根目录手动创建 `.claude/policy.json`：

```json
{
  "autoMode": {
    "allow": [
      "Allow writing the rain-class-reviewer skill manifest file at .claude/skills/rain-class-reviewer/tmp/manifest.json, which only contains course name and classroomId.",
      "Allow running node .claude/skills/rain-class-reviewer/scripts/bootstrap.js commands for course download and summarization."
    ]
  }
}
```

所有命令都应附带 `RAIN_COOKIES` 环境变量：

```bash
set RAIN_COOKIES={"sessionid":"...","csrftoken":"...","uv_id":"0","university_id":"0","xtbz":"ykt"}
node .claude/skills/rain-class-reviewer/scripts/bootstrap.js verify-auth --manifest .claude/skills/rain-class-reviewer/tmp/manifest.json
```

> Git Bash / Linux / macOS 使用 `export RAIN_COOKIES='...'`。

## 安全与隐私

- **禁止在对话中明文输出完整 Cookie**。
- Manifest 写入 Skill 目录下的 `tmp/manifest.json`，覆盖之前的内容；Manifest 中**不得包含 cookies 字段**。`tmp/` 已在 `.gitignore` 中，不会进入版本控制。
- Cookie 只能通过 `RAIN_COOKIES` 环境变量传递，不要单独保存 `cookies.json`。
- 下载目录 `rain-class-reviewer-downloads/` 和临时目录 `tmp/` 已在 `.gitignore` 中。

## 已知限制

- 工具优先使用新版 `lesson-summary` + `presentation` 接口获取完整 PPT；若不可用会自动回退到 `review` 接口，但后者只包含课堂中展示过的幻灯片。
- 总结功能依赖 MiMo API Key，必须通过 `MIMO_TP_API_KEY` 环境变量传入；禁止写入文件。

## 参考

- `references/yuketang-api.md`：长江雨课堂接口清单与约束。
- `references/manifest.example.json`：Manifest 完整示例。
- `docs/usage.md`：CLI 完整参数说明。
- `docs/implementation.md`：实现细节。
