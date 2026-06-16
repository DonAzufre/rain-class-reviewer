# rain-class-reviewer

从长江雨课堂（changjiang.yuketang.cn）下载课程 PPT 图片的命令行工具。

主要特性：

- 通过 chrome-devtools-mcp 自动获取登录 Cookie，无需手动输入。
- 自动发现课程与课时，支持一次课堂多个 PPT。
- 保留同一天多次课堂活动，不再按日期合并。
- 优先下载完整 PPT 幻灯片（含未在课堂展示的页面）。
- 支持按日期、课时 ID 等条件指定下载范围。
- 每页 PPT 生成详细的 Markdown 笔记，最终整合为 `review.md` 复习大纲。
- 断点续传：已下载课时自动跳过，支持 `--force` 强制重下。

## 作为 Agent Skill 安装

本仓库遵循开放的 [Agent Skills](https://agentskills.io) 格式，可直接安装到 Claude Code、OpenCode 等支持 Skill 的 Agent：

```bash
npx skills add DonAzufre/rain-class-reviewer
```

安装后，在 Agent 中输入类似以下指令即可触发：

```text
帮我下载长江雨课堂的计算机网络课件
帮我总结工程伦理概论的复习大纲
```

Skill 会通过 chrome-devtools-mcp 自动连接浏览器、检查登录状态、提取 Cookie 并完成下载与总结。

## 快速开始

### 安装

```bash
npm install
```

Node.js ≥ 18 即可运行，无需浏览器自动化。

### 工具模式

提供课程名和 Cookie，工具自动完成后续步骤。Cookie 可以是文件路径或 JSON 字符串：

```bash
node src/index.js --course "工程伦理概论" --cookies ./cookies.json

# 或直接把 JSON 字符串作为参数
node src/index.js --course "工程伦理概论" --cookies '{"sessionid":"...","csrftoken":"...","uv_id":"0","university_id":"0","xtbz":"ykt"}'

# 直接指定 classroomId（跳过课程名匹配）
node src/index.js --course "工程伦理概论" --classroom-id "13522533" --cookies ./cookies.json
```

`cookies.json` 至少包含 `sessionid`：

```json
{
  "sessionid": "...",
  "csrftoken": "...",
  "uv_id": "0",
  "university_id": "0",
  "xtbz": "ykt"
}
```

### Agent / Skill 模式

Agent 可通过本项目的 `SKILL.md` 自动加载工作流。`scripts/bootstrap.js` 会优先使用预构建的 `dist/cli.cjs`（已包含 `openai` 等依赖），无需联网安装；若不存在才会自动 `npm install`。

> **边界约束**：MCP 仅用于打开页面、检查/等待登录、提取 Cookie、处理复杂/模糊场景。构造出最小 Manifest 后必须停止 MCP，后续所有操作由脚本完成。

Skill 工作流：

1. 询问用户课程名（或关键词）。
2. 通过 chrome-devtools-mcp 连接浏览器并打开长江雨课堂。
3. 检查登录状态；未登录时要求用户登录。
4. 登录后从 DevTools Network 请求头读取 Cookie（支持 HttpOnly Cookie），构造最小 Manifest 并写入 `tmp/manifest.json`，**立即停止 MCP**。
5. 调用 `node <skill-path>/scripts/bootstrap.js verify-auth --manifest <skill-path>/tmp/manifest.json` 校验登录态。
6. 调用 `node <skill-path>/scripts/bootstrap.js list-courses --manifest <skill-path>/tmp/manifest.json --json` 获取课程列表。
7. 根据用户输入匹配课程；有歧义时展示候选并让用户确认 `classroomId`。
8. 使用课程列表返回的原始 courseName，覆盖 `tmp/manifest.json`，调用 `node <skill-path>/scripts/bootstrap.js --manifest <skill-path>/tmp/manifest.json --json` 下载课件图片（默认输出到项目根目录的 `rain-class-reviewer-downloads/`）。
9. 调用 `node <skill-path>/scripts/bootstrap.js summarize --course-dir rain-class-reviewer-downloads/<课程名> ...` 提取 Markdown 笔记并生成 `review.md`。

完整接口清单、Cookie 提取细节与约束见 `references/yuketang-api.md` 和 `SKILL.md`。

手动使用 Manifest：

```bash
node src/index.js --manifest ./manifest.json
```

最简 Manifest 示例：

```json
{
  "version": "1.0",
  "courseName": "工程伦理概论",
  "cookies": { "sessionid": "...", "csrftoken": "...", "uv_id": "0", "university_id": "0", "xtbz": "ykt" }
}
```

## 示例

下载指定课程到 `rain-class-reviewer-downloads/`（默认输出目录）：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json
```

强制重新下载：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json --force
```

校验登录态：

```bash
node src/index.js verify-auth --manifest ./manifest.json
```

列出当前账号课程：

```bash
node src/index.js list-courses --manifest ./manifest.json --json
```

输出 JSON 报告：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json --json
```

只下载最新一次课：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json --latest
```

下载指定日期之后的课：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json --since 2026-06-01
```

下载指定课时：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json \
  --lesson-id 1318590613705012608
```

直接指定 classroomId 下载：

```bash
node src/index.js --course "算法设计与分析" --classroom-id "13522533" --cookies ./cookies.json
```

生成复习大纲（下载完成后）：

```bash
# 总结整门课程
node src/index.js summarize --course-dir "rain-class-reviewer-downloads/算法设计与分析"

# 只总结某一节课
node src/index.js summarize \
  --course-dir "rain-class-reviewer-downloads/算法设计与分析" \
  --lesson-dir "rain-class-reviewer-downloads/算法设计与分析/2024-12-24_1318590613705012608_5.2 贪心法正确性证明（2）"
```

## 文档

- [使用指南](docs/usage.md)：CLI 参数、环境变量、Manifest 格式、输出目录结构。
- [设计文档](docs/design.md)：设计原则、系统架构、接口策略、数据模型。
- [实现细节](docs/implementation.md)：各模块职责、错误处理、并发控制、向后兼容。

## 二期：LLM 总结

已接入小米 MiMo Token Plan CN（OpenAI 兼容协议）：

- Base URL: `https://token-plan-cn.xiaomimimo.com/v1`
- API Key: `tp-xxxxx`
- 模型: `mimo-v2.5` / `mimo-v2.5-pro`
- API Key 优先从 `MIMO_TP_API_KEY` 环境变量读取，其次使用 `--api-key` 或 `RAIN_API_KEY`。

命令预览：

```bash
node src/index.js summarize --course-dir "rain-class-reviewer-downloads/工程伦理概论" --model mimo-v2.5
```
