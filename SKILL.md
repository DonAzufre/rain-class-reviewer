---
name: rain-class-reviewer
description: 从长江雨课堂（changjiang.yuketang.cn）下载课程 PPT 图片并生成 Markdown 复习大纲。当用户提到长江雨课堂、雨课堂、下载课件、生成复习大纲、课程总结、 rain-class-reviewer 时触发。
whenToUse: 用户需要从长江雨课堂下载课件图片、按课时过滤下载，或生成/总结课程复习材料时
type: prompt
disableModelInvocation: false
---

# 长江雨课堂课件下载与复习大纲生成

## 能力概述

本 Skill 帮助用户从长江雨课堂下载课程 PPT 图片，并可选地调用 LLM 生成 Markdown 复习大纲。

- **下载**：输入课程名 + 登录 Cookie，自动发现课程、课时，下载所有 PPT 幻灯片。
- **过滤**：支持按日期、课时 ID、最新课时等条件下载。
- **总结**：对已下载的图片提取笔记并生成 `review.md` 复习大纲。

## 前置条件

1. 已安装 Node.js（>= 18）和 npm。
2. 用户已通过浏览器登录长江雨课堂，并能提供有效 Cookie（至少包含 `sessionid`），或直接提供 Manifest。
3. 用户已明确指定要下载/总结的课程名。

## 快速开始

所有命令都以本 Skill 目录为工作目录执行。首次使用前，依赖会自动安装。

### 查看帮助

```bash
node scripts/bootstrap.js --help
```

### 工具模式：提供课程名和 Cookie 下载

```bash
node scripts/bootstrap.js --course "工程伦理概论" --cookies ./cookies.json
```

### 只下载最新一次课时

```bash
node scripts/bootstrap.js --course "工程伦理概论" --cookies ./cookies.json --latest
```

### 按日期过滤下载

```bash
node scripts/bootstrap.js --course "计算机网络" --cookies ./cookies.json --since 2023-11-01 --until 2023-11-05
```

### 生成复习大纲（先完成下载）

```bash
node scripts/bootstrap.js --course "工程伦理概论" --cookies ./cookies.json
node scripts/bootstrap.js summarize --course-dir "downloads/工程伦理概论"
```

## 标准执行流程

### 1. 获取认证信息

要求用户提供登录 Cookie。Cookie 文件 `cookies.json` 示例：

```json
{
  "sessionid": "your_session_id",
  "csrftoken": "your_csrf_token",
  "uv_id": "2874",
  "university_id": "2874",
  "xtbz": "ykt"
}
```

如果用户已有 Manifest，跳过此步。

### 2. 生成 Manifest（可选）

工具模式会自动发现课程和课时并生成 Manifest。如需精确控制，可手动生成 Manifest：

```json
{
  "version": "1.0",
  "courseName": "工程伦理概论",
  "classroomId": "24932641",
  "cookies": { "sessionid": "..." },
  "headers": { "User-Agent": "..." }
}
```

完整示例见 `references/manifest.example.json`。

### 3. 下载

```bash
node scripts/bootstrap.js --manifest ./manifest.json --json
```

### 4. 总结

```bash
node scripts/bootstrap.js summarize --course-dir "downloads/<课程名>" --force-summary
```

## 课程名歧义处理

- 若存在多个同名课程，工具会报错并列出候选 `classroomId`。
- **禁止擅自选择**，必须向用户展示候选课程并要求确认。
- 确认后，在 Manifest 中显式指定 `classroomId` 再调用。

## 认证失败处理

若工具返回 403 / UNAUTHENTICATED：

1. 说明 `sessionid` 已过期或缺失。
2. 请用户重新登录长江雨课堂并提供最新 Cookie。
3. 更新 `cookies.json` 或 Manifest 中的 `cookies.sessionid`。
4. 重新调用工具。

## 安全与隐私

- **禁止在对话中明文输出用户 Cookie**。
- Cookie 文件和下载产物只保存在本地，不要提交到版本控制。
- 下载目录 `downloads/` 和临时目录 `tmp/` 已在 `.gitignore` 中。

## 已知限制

- 工具优先使用新版 `lesson-summary` + `presentation` 接口获取完整 PPT；若不可用会自动回退到 `review` 接口，但后者只包含课堂中展示过的幻灯片。
- 总结功能依赖 MiMo API Key，需确保环境或 `tmp/mimo-apikey` 文件可用。

## 参考

- `references/manifest.example.json`：Manifest 完整示例。
- `docs/usage.md`：CLI 完整参数说明。
- `docs/implementation.md`：实现细节。
