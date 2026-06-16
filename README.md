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

提供课程名和 Cookie，工具自动完成后续步骤。Cookie 可以是文件路径、JSON 字符串或从 stdin 读取：

```bash
node src/index.js --course "工程伦理概论" --cookies ./cookies.json

# 或直接把 JSON 字符串作为参数
node src/index.js --course "工程伦理概论" --cookies '{"sessionid":"...","csrftoken":"...","uv_id":"2874","university_id":"2874","xtbz":"ykt"}'
```

`cookies.json` 至少包含 `sessionid`：

```json
{
  "sessionid": "...",
  "csrftoken": "...",
  "uv_id": "2874",
  "university_id": "2874",
  "xtbz": "ykt"
}
```

### Agent / Skill 模式

Agent 可通过本项目的 `SKILL.md` 自动加载工作流。首次调用时，Agent 会运行 `scripts/bootstrap.js` 自动安装依赖并调用 CLI。

Skill 工作流：

1. 通过 chrome-devtools-mcp 连接浏览器并打开长江雨课堂。
2. 检查登录状态；未登录时要求用户登录。
3. 登录后自动提取 Cookie。
4. 下载课件图片。
5. 提取每页 Markdown 笔记并生成 `review.md`。

手动使用 Manifest（可通过 stdin 避免临时文件）：

```bash
cat <<'EOF' | node src/index.js --manifest -
{
  "version": "1.0",
  "courseName": "工程伦理概论",
  "cookies": { "sessionid": "...", "csrftoken": "...", "uv_id": "2874", "university_id": "2874", "xtbz": "ykt" }
}
EOF
```

## 示例

下载指定课程到 `downloads/`：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json --output downloads
```

强制重新下载：

```bash
node src/index.js --course "算法设计与分析" --cookies ./cookies.json --force
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

生成复习大纲（下载完成后）：

```bash
# 总结整门课程
node src/index.js summarize --course-dir "downloads/算法设计与分析"

# 只总结某一节课
node src/index.js summarize \
  --course-dir "downloads/算法设计与分析" \
  --lesson-dir "downloads/算法设计与分析/2024-12-24_1318590613705012608_5.2 贪心法正确性证明（2）"
```

## 文档

- [使用指南](docs/usage.md)：CLI 参数、环境变量、Manifest 格式、输出目录结构。
- [设计文档](docs/design.md)：设计原则、系统架构、接口策略、数据模型。
- [实现细节](docs/implementation.md)：各模块职责、错误处理、并发控制、向后兼容。

## 二期：LLM 总结

计划接入小米 MiMo Token Plan CN（OpenAI 兼容协议）：

- Base URL: `https://token-plan-cn.xiaomimimo.com/v1`
- API Key: `tp-xxxxx`
- 模型: `mimo-v2.5` / `mimo-v2.5-pro`

命令预览：

```bash
node src/index.js summarize --course-dir "./工程伦理概论" --model mimo-v2.5
```
