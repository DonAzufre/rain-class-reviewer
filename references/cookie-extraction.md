# 提取长江雨课堂 HttpOnly Cookie

长江雨课堂的 `sessionid` 通常是 **HttpOnly Cookie**，无法通过前端 `document.cookie` 读取。本方案通过 **Chrome DevTools Network 请求头**获取。

## 原理

浏览器发送请求时会自动附加所有 Cookie（包括 HttpOnly）。因此，只要捕获一条发往 `changjiang.yuketang.cn` 的请求，并读取其 **Request Headers** 中的 `Cookie` 字段，即可得到完整的 Cookie 字符串。

## 步骤

### 1. 触发带 Cookie 的网络请求

- 导航到 `https://changjiang.yuketang.cn/`。
- 如果页面已加载，可刷新一次产生新请求：
  ```text
  navigate_page type=reload url=https://changjiang.yuketang.cn/
  ```
- 若请求不够，可通过 `evaluate_script` 触发一次轻量请求（目的仅为产生网络流量，不读取响应数据）：
  ```javascript
  fetch('/v2/api/web/courses/list?identity=2', { credentials: 'include' });
  ```

### 2. 读取请求头中的 Cookie

1. 调用 `list_network_requests` 查看近期请求。
2. 找到目标请求（如页面文档、静态资源或 `/v2/api/web/courses/list`）。
3. 调用 `get_network_request` 读取该请求的 **Request Headers**。
4. 提取 `Cookie` 头，例如：
   ```text
   sessionid=abc123; csrftoken=xyz789; uv_id=2874; university_id=2874; xtbz=ykt
   ```

### 3. 解析所需字段

- `sessionid`：必须。
- `csrftoken`：建议携带，用于 CSRF 校验。
- `uv_id`：通常为 `2874`。
- `university_id`：通常与 `uv_id` 相同。
- `xtbz`：通常为 `ykt`。

## 边界说明

- **允许**：用 MCP 读取网络请求头以获取 Cookie。
- **禁止**：用 MCP 读取 API 响应体来获取课程/课时/PPT 等业务数据；这些必须交给 `scripts/bootstrap.js` 完成。

## 回退方案

如果 MCP 无法提供请求头中的 Cookie：

1. 尝试 `document.cookie` 读取非 HttpOnly Cookie。
2. 仍失败时，请用户手动提供 `sessionid`。
