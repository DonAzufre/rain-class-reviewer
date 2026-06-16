import OpenAI from 'openai';

const BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1';
const DEFAULT_RETRIES = 3;

export function createClient(apiKey) {
  return new OpenAI({
    apiKey,
    baseURL: BASE_URL,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  return err?.status === 429 || err?.code === 'rate_limit_exceeded';
}

export async function callWithRetry(apiCall, retry = DEFAULT_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      return await apiCall();
    } catch (err) {
      lastError = err;

      if (isRateLimitError(err)) {
        // 429 退避：1s, 2s, 4s... 并加上随机抖动
        const delay = Math.min(1000 * 2 ** attempt, 30000) + Math.random() * 500;
        console.warn(`遇到 MiMo 限流 (429)，等待 ${Math.round(delay)}ms 后重试 (${attempt + 1}/${retry + 1})...`);
        await sleep(delay);
        continue;
      }

      // 非 429 错误直接抛出
      throw err;
    }
  }

  throw lastError;
}

function buildImageContent(base64, mimeType = 'image/jpeg') {
  return {
    type: 'image_url',
    image_url: {
      url: `data:${mimeType};base64,${base64}`,
    },
  };
}

function ensureNonEmpty(content) {
  if (!content || !content.trim()) {
    throw new Error('LLM 返回空内容');
  }
  return content.trim();
}

const EXTRACTION_PROMPT = `你是一名优秀的课程笔记整理助手。请仔细识别这张幻灯片中的所有信息，并输出为结构化的 Markdown 笔记。

要求：
1. 提取所有可见文字，包括标题、正文、公式、代码、标注。
2. 若包含图表，描述图表类型和关键数据/趋势。
3. 识别页面类型：cover（封面）、content（正文）、formula（公式推导）、diagram（图表）、summary（总结）、exercise（例题/练习）、unknown（未知）。
4. 用中文输出。
5. 输出纯 Markdown，不要任何解释，不要用代码块包裹全文。

必须包含以下章节：

# 幻灯片标题（若无则为空）

## 页面类型
页面类型，只能是 cover / content / formula / diagram / summary / exercise / unknown 之一。

## 要点
- 要点 1
- 要点 2
...

## 公式
- 公式 1（LaTeX 或纯文本）
...

## 关键词
- 关键词 1
...

## 核心概念
- 核心概念 1
...

## 详细总结
用多段落详细概括本页内容，保留定义、推理过程、示例、图表趋势、易错点等所有有效信息。不要只写 1-3 句话；尽量覆盖幻灯片上出现的全部知识点。`;

export async function extractFromImage(client, model, imageBase64, mimeType = 'image/jpeg', retry = DEFAULT_RETRIES) {
  const response = await callWithRetry(() => client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          buildImageContent(imageBase64, mimeType),
        ],
      },
    ],
    temperature: 0.1,
  }), retry);

  const content = response.choices[0]?.message?.content;
  return ensureNonEmpty(content);
}

const SUMMARY_PROMPT = `你是一名课程复习大纲生成专家。下面是一系列幻灯片的 Markdown 笔记，请跨页面去重、整合，生成一份完整、详细、信息密度高的 Markdown 复习大纲。

要求：
1. 按课程主题/章节组织层级结构。
2. 合并重复概念，保留不同角度的解释和示例。
3. 突出定义、定理、算法、例题、易错点。
4. 保留每页详细总结中的关键细节，不要过度压缩。
5. 使用中文。
6. 输出纯 Markdown，不要代码块包裹。

输出格式示例：
# 课程复习大纲

## 第一章 xxx
### 1.1 xxx
- 要点...
- 详细解释...

## 第二章 xxx
...`;

export async function summarizeNotes(client, model, notes, retry = DEFAULT_RETRIES) {
  // notes 是 { source, content } 数组
  const notesText = notes.map((n) => `<!-- source: ${n.source} -->\n\n${n.content}`).join('\n\n---\n\n');

  const response = await callWithRetry(() => client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: SUMMARY_PROMPT,
      },
      {
        role: 'user',
        content: `以下是幻灯片 Markdown 笔记：\n\n${notesText}`,
      },
    ],
    temperature: 0.3,
  }), retry);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('总结模型返回空内容');
  }

  return content;
}
