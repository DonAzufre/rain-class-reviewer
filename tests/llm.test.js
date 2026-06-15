import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFromImage, summarizeNotes } from '../src/llm.js';

function createFakeClient(responseContent) {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: responseContent } }],
        }),
      },
    },
  };
}

describe('llm', () => {
  it('should extract structured note from image', async () => {
    const note = {
      title: '测试标题',
      bullets: ['要点1', '要点2'],
      formulas: [],
      keywords: ['关键词'],
      concepts: ['概念'],
      summary: '总结',
      pageType: 'content',
    };

    const client = createFakeClient(JSON.stringify(note));
    const result = await extractFromImage(client, 'mimo-v2.5', 'base64data');

    assert.equal(result.title, '测试标题');
    assert.equal(result.bullets.length, 2);
  });

  it('should extract JSON from markdown code block', async () => {
    const note = { title: '代码块', bullets: [], pageType: 'cover' };
    const client = createFakeClient(`\`\`\`json\n${JSON.stringify(note)}\n\`\`\``);
    const result = await extractFromImage(client, 'mimo-v2.5', 'base64data');

    assert.equal(result.title, '代码块');
  });

  it('should throw on non-json response', async () => {
    const client = createFakeClient('这不是 JSON');
    await assert.rejects(
      () => extractFromImage(client, 'mimo-v2.5', 'base64data'),
      /非 JSON/
    );
  });

  it('should summarize notes to markdown', async () => {
    const client = createFakeClient('# 复习大纲\n\n## 第一章\n- 要点');
    const result = await summarizeNotes(client, 'mimo-v2.5-pro', [{ title: 'a' }]);

    assert.ok(result.includes('# 复习大纲'));
  });

  it('should throw on empty summary response', async () => {
    const client = createFakeClient('');
    await assert.rejects(
      () => summarizeNotes(client, 'mimo-v2.5-pro', [{ title: 'a' }]),
      /空内容/
    );
  });
});
