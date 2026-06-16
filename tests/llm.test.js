import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFromImage, summarizeNotes } from '../src/llm.js';

function createFakeClient(responseContent, options = {}) {
  const { fail429Times = 0 } = options;
  let calls = 0;
  return {
    chat: {
      completions: {
        create: async () => {
          calls++;
          if (calls <= fail429Times) {
            const err = new Error('Rate limit exceeded');
            err.status = 429;
            throw err;
          }
          return {
            choices: [{ message: { content: responseContent } }],
          };
        },
      },
    },
  };
}

describe('llm', () => {
  it('should extract markdown note from image', async () => {
    const markdown = `# 测试标题

## 页面类型
content

## 要点
- 要点1
- 要点2

## 详细总结
这是详细总结的第一段。这是第二段。`;

    const client = createFakeClient(markdown);
    const result = await extractFromImage(client, 'mimo-v2.5', 'base64data');

    assert.ok(result.includes('# 测试标题'));
    assert.ok(result.includes('## 页面类型'));
    assert.ok(result.includes('## 详细总结'));
  });

  it('should keep markdown code block content as-is', async () => {
    const markdown = `# 代码块标题
\`\`\`json
{"a": 1}
\`\`\`

## 详细总结
包含代码块。`;

    const client = createFakeClient(markdown);
    const result = await extractFromImage(client, 'mimo-v2.5', 'base64data');

    assert.ok(result.includes('# 代码块标题'));
    assert.ok(result.includes('{"a": 1}'));
  });

  it('should throw on empty response', async () => {
    const client = createFakeClient('');
    await assert.rejects(
      () => extractFromImage(client, 'mimo-v2.5', 'base64data'),
      /空内容/
    );
  });

  it('should summarize notes to markdown', async () => {
    const client = createFakeClient('# 复习大纲\n\n## 第一章\n- 要点');
    const result = await summarizeNotes(client, 'mimo-v2.5-pro', [{ source: 'a.jpg', content: '# 笔记\n内容' }]);

    assert.ok(result.includes('# 复习大纲'));
  });

  it('should throw on empty summary response', async () => {
    const client = createFakeClient('');
    await assert.rejects(
      () => summarizeNotes(client, 'mimo-v2.5-pro', [{ source: 'a.jpg', content: '内容' }]),
      /空内容/
    );
  });

  it('should retry on 429 rate limit', async () => {
    const markdown = `# retry

## 页面类型
content

## 详细总结
retry 测试。`;
    const client = createFakeClient(markdown, { fail429Times: 1 });
    const result = await extractFromImage(client, 'mimo-v2.5', 'base64', 'image/jpeg', 3);
    assert.ok(result.includes('# retry'));
  });

  it('should throw after exhausting 429 retries', async () => {
    const client = createFakeClient('', { fail429Times: 5 });
    await assert.rejects(
      () => extractFromImage(client, 'mimo-v2.5', 'base64', 'image/jpeg', 2),
      /Rate limit/
    );
  });
});
