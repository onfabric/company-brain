import { describe, expect, it } from 'bun:test';
import {
  knowledgePagePath,
  renderKnowledgeHtmlPage,
  sanitizeKnowledgeHtml,
} from '#lib/knowledge-html.ts';

const KNOWLEDGE_ID = '019e8882-07f1-771c-993e-f6825a9224bb';
const LINKED_KNOWLEDGE_ID = '019e8882-07f1-771c-993e-f6825a9224bc';

describe('knowledge HTML', () => {
  it('builds the canonical page path', () => {
    expect(knowledgePagePath(KNOWLEDGE_ID)).toBe(`/knowledge/pages/${KNOWLEDGE_ID}`);
  });

  it('sanitizes unsafe markup while preserving knowledge links', () => {
    const sanitized = sanitizeKnowledgeHtml(
      `<p>See <a href="knowledge:${LINKED_KNOWLEDGE_ID}">next</a><img src="knowledge:${LINKED_KNOWLEDGE_ID}"></p><script>alert("x")</script>`,
    );

    expect(sanitized).toContain(`knowledge:${LINKED_KNOWLEDGE_ID}`);
    expect(sanitized).not.toContain(`<img src="knowledge:${LINKED_KNOWLEDGE_ID}"`);
    expect(sanitized).not.toContain('<script>');
  });

  it('renders a complete HTML page and rewrites knowledge links', () => {
    const html = renderKnowledgeHtmlPage({
      id: KNOWLEDGE_ID,
      title: 'Pricing <Decision>',
      updated_at: '2026-06-06T00:00:00.000Z',
      body: `<p>See <a href="knowledge:${LINKED_KNOWLEDGE_ID}">next</a></p><a href="javascript:alert(1)">bad</a>`,
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Pricing &lt;Decision&gt;');
    expect(html).toContain(`/knowledge/pages/${LINKED_KNOWLEDGE_ID}`);
    expect(html).not.toContain('javascript:');
  });
});
