# rain-class-reviewer

从长江雨课堂（changjiang.yuketang.cn）下载课程 PPT 图片的命令行工具。

主要特性：

- 自动发现课程与课时，支持一次课堂多个 PPT。
- 保留同一天多次课堂活动，不再按日期合并。
- 优先下载完整 PPT 幻灯片（含未在课堂展示的页面）。
- 断点续传：已下载课时自动跳过，支持 `--force` 强制重下。

## 快速开始

### 安装

```bash
npm install
```

Node.js ≥ 18 即可运行，无需浏览器自动化。

### 工具模式

提供课程名和 Cookie，工具自动完成后续步骤：

```bash
node src/index.js --course "工程伦理概论" --cookies ./cookies.json
```

`cookies.json` 至少包含 `sessionid`：

```json
{
  "sessionid": "...",
  "csrftoken": "...",
  "uv_id": "...",
  "university_id": "...",
  "xtbz": "ykt"
}
```

### Agent / Skill 模式

让 Agent 通过 Chrome DevTools MCP 读取登录态 Cookie，生成 Manifest 后调用工具：

```bash
node src/index.js --manifest ./manifest.json
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

生成复习大纲（下载完成后）：

```bash
node src/index.js summarize --course-dir "downloads/算法设计与分析"
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
