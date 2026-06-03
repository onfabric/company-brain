import type { RawNotionBlock, RawRichText, RenderedContent, RichTextBlock } from './api-types.js';
import { fetchBlockChildren } from './client.js';
import type { SyncContext, UserDirectory } from './context.js';
import { mapFile } from './files.js';
import { referenceForDatabaseId, referenceForPageId } from './references.js';
import { renderReferenceText, renderRichText, renderRichTextSync } from './rich-text.js';
import {
  compactJoin,
  indentMarkdown,
  isExpiringUrl,
  maxBlockDepth,
  notionUrlFromId,
  quoteMarkdown,
  titleCase,
  withoutUndefined,
} from './utils.js';

export async function renderPageContent(
  ctx: SyncContext,
  blockId: string,
  depth: number,
): Promise<RenderedContent> {
  if (depth > maxBlockDepth(ctx.metadata)) {
    return emptyRenderedContent();
  }

  const blocks = await fetchBlockChildren(ctx, blockId);
  const result = emptyRenderedContent();
  const renderedBlocks: string[] = [];

  for (const block of blocks) {
    const rendered = await renderBlock(ctx, block, depth);
    mergeRenderedContent(result, rendered);

    if (rendered.markdown) {
      renderedBlocks.push(rendered.markdown);
    }
  }

  result.markdown = compactJoin(renderedBlocks, '\n\n');
  return result;
}

export function emptyRenderedContent(): RenderedContent {
  return {
    markdown: '',
    files: [],
    links: [],
    mentionedPeople: [],
    childPages: [],
    childDatabases: [],
    relatedPages: [],
    pageIds: [],
    databaseIds: [],
    dataSourceIds: [],
  };
}

export function mergeRenderedContent(target: RenderedContent, source: RenderedContent): void {
  target.files.push(...source.files);
  target.links.push(...source.links);
  target.mentionedPeople.push(...source.mentionedPeople);
  target.childPages.push(...source.childPages);
  target.childDatabases.push(...source.childDatabases);
  target.relatedPages.push(...source.relatedPages);
  target.pageIds.push(...source.pageIds);
  target.databaseIds.push(...source.databaseIds);
  target.dataSourceIds.push(...source.dataSourceIds);
}

async function renderBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  depth: number,
): Promise<RenderedContent> {
  const result = emptyRenderedContent();
  const type = block.type;

  switch (type) {
    case 'paragraph':
      return await renderRichTextBlock(ctx, block, block.paragraph, depth);
    case 'bulleted_list_item':
      return renderListItemBlock(ctx, block, block.bulleted_list_item, '- ', depth);
    case 'numbered_list_item':
      return renderListItemBlock(ctx, block, block.numbered_list_item, '1. ', depth);
    case 'quote':
      return renderQuoteBlock(ctx, block, block.quote, depth);
    case 'callout':
      return renderQuoteBlock(ctx, block, block.callout, depth);
    case 'toggle':
      return renderToggleBlock(ctx, block, block.toggle, depth);
    case 'to_do':
      return renderTodoBlock(ctx, block, depth);
    case 'template':
      return renderRichTextBlock(ctx, block, block.template, depth);
    case 'heading_1':
      return renderHeadingBlock(ctx, block, block.heading_1, '#', depth);
    case 'heading_2':
      return renderHeadingBlock(ctx, block, block.heading_2, '##', depth);
    case 'heading_3':
      return renderHeadingBlock(ctx, block, block.heading_3, '###', depth);
    case 'heading_4':
      return renderHeadingBlock(ctx, block, block.heading_4, '####', depth);
    case 'code':
      return renderCodeBlock(ctx, block);
    case 'equation':
      result.markdown = block.equation?.expression ? `$$\n${block.equation.expression}\n$$` : '';
      return result;
    case 'divider':
      result.markdown = '---';
      return result;
    case 'bookmark':
      return renderUrlBlock(
        block.bookmark?.url,
        renderRichTextSync(block.bookmark?.caption, ctx.userEmailsById),
        result,
      );
    case 'embed':
      return renderUrlBlock(block.embed?.url, 'Embed', result);
    case 'link_preview':
      return renderUrlBlock(block.link_preview?.url, 'Link preview', result);
    case 'audio':
      return renderFileBlock('audio', block.audio, result);
    case 'file':
      return renderFileBlock('file', block.file, result);
    case 'image':
      return renderFileBlock('image', block.image, result);
    case 'pdf':
      return renderFileBlock('pdf', block.pdf, result);
    case 'video':
      return renderFileBlock('video', block.video, result);
    case 'child_page':
      return renderChildPageBlock(block, result);
    case 'child_database':
      return renderChildDatabaseBlock(block, result);
    case 'link_to_page':
      return renderLinkToPageBlock(ctx, block, result);
    case 'column_list':
    case 'column':
    case 'synced_block':
      return renderContainerBlock(ctx, block, depth);
    case 'table':
      return renderTableBlock(ctx, block, depth);
    case 'table_row':
      result.markdown = renderTableRow(block.table_row?.cells ?? [], ctx.userEmailsById);
      return result;
    case 'breadcrumb':
    case 'table_of_contents':
      return result;
    case 'unsupported':
      result.markdown = block.unsupported?.block_type
        ? `[Unsupported Notion block: ${block.unsupported.block_type}]`
        : '[Unsupported Notion block]';
      return result;
    default:
      if (block.has_children) {
        return renderContainerBlock(ctx, block, depth);
      }
      return result;
  }
}

async function renderRichTextBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  richTextBlock: RichTextBlock | undefined,
  depth: number,
): Promise<RenderedContent> {
  const result = emptyRenderedContent();
  mergeRichText(result, renderRichText(richTextBlock?.rich_text, ctx.userEmailsById));
  const childContent = block.has_children
    ? await renderPageContent(ctx, block.id, depth + 1)
    : undefined;
  mergeOptionalRenderedContent(result, childContent);
  result.markdown = compactJoin([result.markdown, childContent?.markdown], '\n\n');
  return result;
}

async function renderHeadingBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  richTextBlock: RichTextBlock | undefined,
  prefix: string,
  depth: number,
): Promise<RenderedContent> {
  const result = emptyRenderedContent();
  const richText = renderRichText(richTextBlock?.rich_text, ctx.userEmailsById);
  mergeRichText(result, richText);
  const childContent = block.has_children
    ? await renderPageContent(ctx, block.id, depth + 1)
    : undefined;
  mergeOptionalRenderedContent(result, childContent);
  result.markdown = compactJoin(
    [`${prefix} ${richText.text}`.trim(), childContent?.markdown],
    '\n\n',
  );
  return result;
}

async function renderListItemBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  richTextBlock: RichTextBlock | undefined,
  prefix: string,
  depth: number,
): Promise<RenderedContent> {
  const result = emptyRenderedContent();
  const richText = renderRichText(richTextBlock?.rich_text, ctx.userEmailsById);
  mergeRichText(result, richText);
  const childContent = block.has_children
    ? await renderPageContent(ctx, block.id, depth + 1)
    : undefined;
  mergeOptionalRenderedContent(result, childContent);
  result.markdown = compactJoin(
    [
      `${prefix}${richText.text || '(empty)'}`,
      childContent?.markdown ? indentMarkdown(childContent.markdown) : undefined,
    ],
    '\n',
  );
  return result;
}

async function renderQuoteBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  richTextBlock: RichTextBlock | undefined,
  depth: number,
): Promise<RenderedContent> {
  const result = await renderRichTextBlock(ctx, block, richTextBlock, depth);
  result.markdown = quoteMarkdown(result.markdown);
  return result;
}

async function renderToggleBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  richTextBlock: RichTextBlock | undefined,
  depth: number,
): Promise<RenderedContent> {
  const result = emptyRenderedContent();
  const richText = renderRichText(richTextBlock?.rich_text, ctx.userEmailsById);
  mergeRichText(result, richText);
  const childContent = block.has_children
    ? await renderPageContent(ctx, block.id, depth + 1)
    : undefined;
  mergeOptionalRenderedContent(result, childContent);
  result.markdown = compactJoin(
    [
      `Toggle: ${richText.text || '(empty)'}`,
      childContent?.markdown ? indentMarkdown(childContent.markdown) : undefined,
    ],
    '\n',
  );
  return result;
}

async function renderTodoBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  depth: number,
): Promise<RenderedContent> {
  const result = emptyRenderedContent();
  const richText = renderRichText(block.to_do?.rich_text, ctx.userEmailsById);
  mergeRichText(result, richText);
  const childContent = block.has_children
    ? await renderPageContent(ctx, block.id, depth + 1)
    : undefined;
  mergeOptionalRenderedContent(result, childContent);
  const checkbox = block.to_do?.checked ? '[x]' : '[ ]';
  result.markdown = compactJoin(
    [
      `- ${checkbox} ${richText.text || '(empty)'}`,
      childContent?.markdown ? indentMarkdown(childContent.markdown) : undefined,
    ],
    '\n',
  );
  return result;
}

function renderCodeBlock(ctx: SyncContext, block: RawNotionBlock): RenderedContent {
  const result = emptyRenderedContent();
  const richText = renderRichText(block.code?.rich_text, ctx.userEmailsById);
  mergeRichText(result, richText);
  const language = block.code?.language ?? '';
  result.markdown = `\`\`\`${language}\n${richText.text}\n\`\`\``;
  return result;
}

function renderUrlBlock(
  url: string | undefined,
  label: string | undefined,
  result: RenderedContent,
): RenderedContent {
  if (!url || isExpiringUrl(url)) {
    result.markdown = label ?? '';
    return result;
  }

  const text = label && label !== url ? label : url;
  result.links.push(withoutUndefined({ url, text: label && label !== url ? label : undefined }));
  result.markdown = `[${text}](${url})`;
  return result;
}

function renderFileBlock(
  kind: string,
  file: RawNotionBlock['file'],
  result: RenderedContent,
): RenderedContent {
  const mappedFile = mapFile(kind, file);
  if (!mappedFile) {
    return result;
  }

  result.files.push(mappedFile);
  if (mappedFile.url) {
    result.links.push({ url: mappedFile.url, text: mappedFile.name ?? mappedFile.kind });
    result.markdown = `${titleCase(kind)}: [${mappedFile.name ?? mappedFile.url}](${mappedFile.url})`;
    return result;
  }

  result.markdown = `${titleCase(kind)}: ${mappedFile.name ?? mappedFile.caption ?? 'Notion-hosted file'}`;
  return result;
}

function renderChildPageBlock(block: RawNotionBlock, result: RenderedContent): RenderedContent {
  const ref = withoutUndefined({
    title: block.child_page?.title ?? 'Notion page',
    url: notionUrlFromId(block.id),
  });
  result.childPages.push(ref);
  result.pageIds.push(block.id);
  result.markdown = renderReference('Page', ref);
  return result;
}

function renderChildDatabaseBlock(block: RawNotionBlock, result: RenderedContent): RenderedContent {
  const ref = withoutUndefined({
    title: block.child_database?.title ?? 'Notion database',
    url: notionUrlFromId(block.id),
  });
  result.childDatabases.push(ref);
  result.databaseIds.push(block.id);
  result.markdown = renderReference('Database', ref);
  return result;
}

async function renderLinkToPageBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  result: RenderedContent,
): Promise<RenderedContent> {
  if (block.link_to_page?.type === 'page_id' && block.link_to_page.page_id) {
    const ref = await referenceForPageId(ctx, block.link_to_page.page_id);
    result.relatedPages.push(ref);
    result.pageIds.push(block.link_to_page.page_id);
    result.markdown = renderReference('Linked page', ref);
    return result;
  }

  if (block.link_to_page?.type === 'database_id' && block.link_to_page.database_id) {
    const ref = await referenceForDatabaseId(ctx, block.link_to_page.database_id);
    result.childDatabases.push(ref);
    result.databaseIds.push(block.link_to_page.database_id);
    result.markdown = renderReference('Linked database', ref);
  }

  return result;
}

async function renderContainerBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  depth: number,
): Promise<RenderedContent> {
  return block.has_children
    ? await renderPageContent(ctx, block.id, depth + 1)
    : emptyRenderedContent();
}

async function renderTableBlock(
  ctx: SyncContext,
  block: RawNotionBlock,
  depth: number,
): Promise<RenderedContent> {
  const rows = await fetchBlockChildren(ctx, block.id);
  const result = emptyRenderedContent();
  const renderedRows = rows
    .filter((row) => row.type === 'table_row')
    .map((row) => row.table_row?.cells ?? []);

  if (renderedRows.length === 0) {
    return result;
  }

  for (const row of renderedRows) {
    for (const cell of row) {
      mergeRichText(result, renderRichText(cell, ctx.userEmailsById));
    }
  }

  const rowLines = renderedRows.map((cells) => renderTableRow(cells, ctx.userEmailsById));
  const firstRow = renderedRows[0] ?? [];
  const separator = `| ${firstRow.map(() => '---').join(' | ')} |`;
  const [header, ...bodyRows] = rowLines;
  const table = [header, separator, ...bodyRows];

  result.markdown = table.filter(Boolean).join('\n');

  for (const row of rows) {
    if (row.has_children) {
      const nested = await renderPageContent(ctx, row.id, depth + 1);
      mergeRenderedContent(result, nested);
    }
  }

  return result;
}

function renderTableRow(cells: RawRichText[][] | undefined, directory: UserDirectory): string {
  return `| ${(cells ?? []).map((cell) => renderRichText(cell, directory).text.replace(/\|/g, '\\|')).join(' | ')} |`;
}

function mergeOptionalRenderedContent(
  target: RenderedContent,
  source: RenderedContent | undefined,
): void {
  if (source) {
    mergeRenderedContent(target, source);
  }
}

function mergeRichText(target: RenderedContent, richText: ReturnType<typeof renderRichText>): void {
  target.markdown = richText.text;
  target.links.push(...richText.links);
  target.mentionedPeople.push(...richText.mentionedPeople);
  target.relatedPages.push(...richText.relatedPages);
  target.childDatabases.push(...richText.childDatabases);
  target.pageIds.push(...richText.pageIds);
  target.databaseIds.push(...richText.databaseIds);
}

function renderReference(label: string, ref: { title: string; url?: string | undefined }): string {
  return `${label}: ${renderReferenceText(ref)}`;
}
