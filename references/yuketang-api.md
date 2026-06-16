# 长江雨课堂（changjiang.yuketang.cn）接口参考

本文件列出 `rain-class-reviewer` 实际使用的所有接口。LLM 必须优先使用这些已知接口，禁止凭幻觉构造其他端点。

## 公共约定

- **域名**：`https://changjiang.yuketang.cn`
- **协议**：HTTPS，JSON API
- **必需 Cookie**：
  - `sessionid`：登录会话 ID，**必须**。
  - `csrftoken`：CSRF 防护 Token，建议携带。
  - `uv_id`：学校/站点 ID，通常为 `2874`。
  - `university_id`：大学 ID，通常与 `uv_id` 相同。
  - `xtbz`：固定值 `ykt`。
- **通用请求头**：
  - `User-Agent`: 浏览器 UA。
  - `Referer`: 当前页面 URL，不同接口要求不同。
  - `X-CSRFToken`: `csrftoken` 的值。
  - `classroom-id`: 课程班级 ID（部分接口需要）。
  - `university-id`: `university_id`。
  - `uv-id`: `uv_id`。
  - `xtbz`: `ykt`。
  - `xt-agent`: `web`。
  - `x-client`: `web`。

## 1. 登录态校验 / 课程列表

**用途**：验证 `sessionid` 是否有效，并获取用户课程列表。

```http
GET /v2/api/web/courses/list?identity=2 HTTP/1.1
Host: changjiang.yuketang.cn
Referer: https://changjiang.yuketang.cn/v2/web/index
Cookie: sessionid=...; csrftoken=...; uv_id=2874; university_id=2874; xtbz=ykt
```

**成功响应示例**：

```json
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "list": [
      {
        "classroom_id": "13522533",
        "name": "21计算机类地方本科班",
        "course": { "id": "...", "name": "计算机网络" },
        "teacher": { "name": "杨翔瑞" }
      }
    ]
  }
}
```

**失败示例**：

```json
{ "errcode": 1001, "errmsg": "未登录" }
```

## 2. 课时列表

**用途**：获取某课程下的所有课堂活动（仅取 `type === 14` 的课件活动）。

```http
GET /v2/api/web/logs/learn/{classroomId}?actype=-1&page=0&offset=100&sort=-1 HTTP/1.1
Host: changjiang.yuketang.cn
Referer: https://changjiang.yuketang.cn/v2/web/studentLog/{classroomId}
classroom-id: {classroomId}
Cookie: sessionid=...
```

**关键字段**：

- `activities[].id`：活动 ID（`activityId`）。
- `activities[].courseware_id`：课件 ID（作为 `lessonId`）。
- `activities[].title`：课时标题。
- `activities[].create_time`：创建时间（用于生成 `date`）。
- `activities[].type`：只取 `14`。

## 3. 新版 PPT 提取（优先）

### 3.1 课件概览

```http
GET /api/v3/lesson-summary/student?lesson_id={lessonId} HTTP/1.1
Host: changjiang.yuketang.cn
Referer: https://changjiang.yuketang.cn/v2/web/student-v3/{classroomId}/{lessonId}/{activityId}
classroom-id: {classroomId}
Cookie: sessionid=...
```

**成功响应关键字段**：

```json
{
  "code": 0,
  "data": {
    "presentations": [
      { "id": "...", "title": "..." }
    ]
  }
}
```

### 3.2 单个 PPT 幻灯片

```http
GET /api/v3/lesson-summary/student/presentation?presentation_id={presentationId}&lesson_id={lessonId} HTTP/1.1
Host: changjiang.yuketang.cn
Referer: https://changjiang.yuketang.cn/v2/web/student-v3/{classroomId}/{lessonId}/{activityId}
classroom-id: {classroomId}
Cookie: sessionid=...
```

**成功响应关键字段**：

```json
{
  "code": 0,
  "data": {
    "slides": [
      { "cover": "https://changjiang-private-qn.yuketang.cn/slide/..." }
    ]
  }
}
```

## 4. 旧版回退接口

仅当新版接口 404 或无 `presentations` 时使用，通常只能拿到课堂展示过的幻灯片。

### 4.1 Review 时间线

```http
GET /api/v3/classroom-report/student/review?lesson_id={lessonId}&front_time={timestamp} HTTP/1.1
Host: changjiang.yuketang.cn
Referer: https://changjiang.yuketang.cn/m/v2/lesson/student/{lessonId}/overview
Cookie: sessionid=...
```

**关键字段**：

- `data.timelineList[].type === 'slide'`
- `data.timelineList[].index`
- `data.timelineList[].cover`
- `data.timelineList[].visible`
- `data.timelineList[].firstTime`

### 4.2 课时详情（用于页数校验）

```http
GET /api/v3/classroom-report/student/detail?lesson_id={lessonId}&front_time={timestamp} HTTP/1.1
Host: changjiang.yuketang.cn
Referer: https://changjiang.yuketang.cn/m/v2/lesson/student/{lessonId}/overview
Cookie: sessionid=...
```

**关键字段**：

- `data.presentation[].totalCount`：PPT 总页数，用于提示是否只拿到部分页。

## 5. 图片 URL 模板

完整 PPT 图片 URL 形如：

```text
https://changjiang-private-qn.yuketang.cn/slide/{slideId}/cover{coverId}_{timestamp}.jpg?e={expire}&token={token}
```

其中 `token` 为 `{tokenBase}:{tokenSuffix}`。

## 6. 常见错误与处理

| 现象 | 含义 | 处理 |
|------|------|------|
| 响应 `errcode`/`code` 非 0，或包含“未登录” | `sessionid` 无效或过期 | 重新通过 MCP 登录获取 Cookie |
| HTTP 403 | 认证失败 | 同上 |
| 新版接口 404 或无 `presentations` | 该课时没有多 PPT 结构或接口不可用 | 自动回退到 review 接口 |
| review 接口仍无图片 | 该课时可能未展示任何幻灯片 | 报错并跳过 |
| 课程名匹配到多个 `classroom_id` | 同名课程多个班级 | 必须向用户展示候选并确认 `classroomId` |

## 7. 对 LLM 的约束

- **禁止**使用浏览器 MCP 直接调用上述接口、翻页或解析 HTML 抓数据。
- 浏览器 MCP 仅用于：打开页面、检查/等待登录、提取 `document.cookie`、处理需要人工操作的复杂/模糊场景。
- 拿到 Cookie 后，必须构造最小 Manifest 并调用 `scripts/bootstrap.js` 继续。
