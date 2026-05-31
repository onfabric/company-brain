import type { RawNotionUser, RawRichText, RenderedRichText } from './api-types.js';
import type { NotionPerson } from './models.js';
import {
  firstNonExpiringUrl,
  notionUrlFromId,
  renderDateRange,
  withoutUndefined,
} from './utils.js';

export function renderRichText(richText: RawRichText[] | undefined): RenderedRichText {
  const result: RenderedRichText = {
    text: '',
    links: [],
    mentionedPeople: [],
    relatedPages: [],
    childDatabases: [],
    pageIds: [],
    databaseIds: [],
  };

  for (const item of richText ?? []) {
    const plainText = richTextPlainText(item);
    const url = firstNonExpiringUrl(
      item.href ?? undefined,
      item.text?.link?.url,
      item.mention?.link_preview?.url,
    );

    if (item.type === 'mention' && item.mention?.type === 'page' && item.mention.page?.id) {
      const ref = withoutUndefined({
        title: plainText || 'Notion page',
        url: url ?? notionUrlFromId(item.mention.page.id),
      });
      result.relatedPages.push(ref);
      result.pageIds.push(item.mention.page.id);
      result.text += renderReferenceText(ref);
      continue;
    }

    if (item.type === 'mention' && item.mention?.type === 'database' && item.mention.database?.id) {
      const ref = withoutUndefined({
        title: plainText || 'Notion database',
        url: url ?? notionUrlFromId(item.mention.database.id),
      });
      result.childDatabases.push(ref);
      result.databaseIds.push(item.mention.database.id);
      result.text += renderReferenceText(ref);
      continue;
    }

    if (item.type === 'mention' && item.mention?.type === 'date') {
      result.text += renderDateRange(item.mention.date);
      continue;
    }

    if (item.type === 'mention' && item.mention?.type === 'user') {
      const person = toPersonRef(item.mention.user);
      if (person) {
        result.mentionedPeople.push(person);
      }
      result.text += person ? renderPerson(person) : plainText;
      continue;
    }

    if (item.type === 'equation' && item.equation?.expression) {
      result.text += item.equation.expression;
      continue;
    }

    const formattedText = applyAnnotations(plainText, item.annotations);
    if (url) {
      result.links.push({ url, text: plainText || undefined });
      result.text += `[${formattedText || url}](${url})`;
    } else {
      result.text += formattedText;
    }
  }

  return result;
}

export function renderRichTextSync(richText: RawRichText[] | undefined): string | undefined {
  const text = renderRichText(richText).text;
  return text || undefined;
}

export function titleFromRichText(richText: RawRichText[] | undefined): string | undefined {
  const title = richText
    ?.map((item) => item.plain_text ?? item.text?.content ?? '')
    .join('')
    .trim();
  return title || undefined;
}

export function userName(user: RawNotionUser | undefined | null): string | undefined {
  return toPersonRef(user)?.identifier;
}

export function toPersonRef(user: RawNotionUser | undefined | null): NotionPerson | undefined {
  if (!user) {
    return undefined;
  }

  const identifier = user.person?.email ?? user.id;
  if (!identifier) {
    return undefined;
  }

  return { identifier };
}

export function renderPerson(person: NotionPerson): string {
  return person.identifier;
}

export function renderReferenceText(ref: { title: string; url?: string | undefined }): string {
  return ref.url ? `[${ref.title}](${ref.url})` : ref.title;
}

function richTextPlainText(item: RawRichText): string {
  return item.plain_text ?? item.text?.content ?? item.equation?.expression ?? '';
}

function applyAnnotations(text: string, annotations: RawRichText['annotations']): string {
  let formatted = text;
  if (!formatted) {
    return formatted;
  }

  if (annotations?.code) {
    formatted = `\`${formatted}\``;
  }
  if (annotations?.bold) {
    formatted = `**${formatted}**`;
  }
  if (annotations?.italic) {
    formatted = `_${formatted}_`;
  }
  if (annotations?.strikethrough) {
    formatted = `~~${formatted}~~`;
  }
  return formatted;
}
