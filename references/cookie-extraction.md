# 提取长江雨课堂 HttpOnly Cookie

长江雨课堂的 `sessionid` 通常是 **HttpOnly Cookie**，无法通过前端 `document.cookie` 读取。本方案通过 **Chrome DevTools Network 请求头**获取。

## 原理

浏览器发送请求时会自动附加所有 Cookie（包括 HttpOnly）。因此，只要捕获一条发往 `changjiang.yuketang.cn` 的请求，并读取其 **Request Headers** 中的 `Cookie` 字段，即可得到完整的 Cookie 字符串。

## 步骤

### 1. 打开页面并触发带 Cookie 的网络请求

**必须打开/刷新的 URL**：

```text
https://changjiang.yuketang.cn/
```

- 如果页面已加载，可刷新一次产生新请求：
  ```text
  navigate_page type=reload url=https://changjiang.yuketang.cn/
  ```

**首选触发 URL**（与 `verify-auth` / `list-courses` 使用的课程列表接口一致）：

```text
GET https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2
```

- 若请求不够，可通过 `evaluate_script` 触发一次轻量请求（目的仅为产生网络流量，不读取响应数据）：
  ```javascript
  fetch('https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2', { credentials: 'include' });
  ```

**备用触发 URL**：

```text
https://changjiang.yuketang.cn/            （页面文档）
https://changjiang.yuketang.cn/v2/web/index （首页入口）
https://changjiang.yuketang.cn/*           （同域名静态资源）
```

### 2. 读取请求头中的 Cookie

1. 调用 `list_network_requests` 查看近期请求。
2. 按优先级选择目标请求：
   - 优先：`https://changjiang.yuketang.cn/v2/api/web/courses/list?identity=2`
   - 次选：`https://changjiang.yuketang.cn/` 或 `https://changjiang.yuketang.cn/v2/web/index`
   - 可接受：任何 `https://changjiang.yuketang.cn/*` 请求
3. 调用 `get_network_request` 读取该请求的 **Request Headers**。
4. 提取 `Cookie` 头，例如：
   ```text
   sessionid=abc123; csrftoken=xyz789; uv_id=0; university_id=0; xtbz=ykt
   ```

### 3. 解析所需字段

- `sessionid`：必须。
- `csrftoken`：建议携带，用于 CSRF 校验。
- `uv_id`：按 Cookie 头中的实际值提取，可能是 `0` 或其他值，不要硬编码。
- `university_id`：按 Cookie 头中的实际值提取，可能与 `uv_id` 相同或不同。
- `xtbz`：通常为 `ykt`。
- `django_language`：可选。

## 边界说明

- **允许**：用 MCP 读取网络请求头以获取 Cookie。
- **禁止**：用 MCP 读取 API 响应体来获取课程/课时/PPT 等业务数据；这些必须交给 `scripts/bootstrap.js` 完成。
- **禁止**：把 Cookie 写入 Manifest 文件或任何磁盘文件，敏感信息只能通过 `RAIN_COOKIES` 环境变量传递。

## 传给脚本

把解析出的字段组装成 JSON，通过 `RAIN_COOKIES` 环境变量传入：

```bash
# Windows CMD
set RAIN_COOKIES={"sessionid":"abc123","csrftoken":"xyz789","uv_id":"0","university_id":"0","xtbz":"ykt"}

# Git Bash / Linux / macOS
export RAIN_COOKIES='{"sessionid":"abc123","csrftoken":"xyz789","uv_id":"0","university_id":"0","xtbz":"ykt"}'
```

## 回退方案

如果 MCP 无法提供请求头中的 Cookie：

1. 尝试 `document.cookie` 读取非 HttpOnly Cookie。
2. 仍失败时，请用户手动提供 `sessionid`。
