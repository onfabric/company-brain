import type { RawNotionFile, RawNotionPage } from './api-types.js';
import type { NotionFile } from './models.js';
import { renderRichTextSync } from './rich-text.js';
import { isExpiringUrl, titleCase, withoutUndefined } from './utils.js';

export function mapPageFiles(page: RawNotionPage): NotionFile[] {
  const files: NotionFile[] = [];

  if (page.cover) {
    const cover = mapFile('cover', page.cover);
    if (cover) {
      files.push(cover);
    }
  }

  if (page.icon && 'type' in page.icon && page.icon.type !== 'emoji') {
    const icon = mapFile('icon', page.icon as RawNotionFile);
    if (icon) {
      files.push(icon);
    }
  }

  return files;
}

export function mapFile(kind: string, file: RawNotionFile | undefined): NotionFile | undefined {
  if (!file) {
    return undefined;
  }

  const caption = renderRichTextSync(file.caption);
  const externalUrl =
    file.external?.url && !isExpiringUrl(file.external.url) ? file.external.url : undefined;
  return withoutUndefined({
    kind,
    name: file.name,
    caption,
    url: file.type === 'external' ? externalUrl : undefined,
  });
}

export function renderFileSummary(file: NotionFile): string {
  const label = file.name ?? file.caption ?? titleCase(file.kind);
  return file.url ? `${label} (${file.url})` : label;
}
