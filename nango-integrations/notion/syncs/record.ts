import type { RawNotionPage } from './api-types.js';
import { renderPageContent } from './blocks.js';
import type { SyncContext } from './context.js';
import { mapPageFiles, renderFileSummary } from './files.js';
import type {
  NotionFile,
  NotionLink,
  NotionPage,
  NotionParent,
  NotionPerson,
  NotionProperty,
  NotionReference,
} from './models.js';
import { mapProperties } from './properties.js';
import { mapParent, titleFromPage } from './references.js';
import { renderPerson, renderReferenceText, toPersonRef } from './rich-text.js';
import {
  notionUrlFromId,
  uniqueFiles,
  uniqueLinks,
  uniquePeople,
  uniqueProperties,
  uniqueRefs,
  withoutUndefined,
} from './utils.js';

export type PageBuildResult = {
  record: NotionPage;
  pageIds: string[];
  databaseIds: string[];
  dataSourceIds: string[];
};

export async function buildPageRecord(
  ctx: SyncContext,
  page: RawNotionPage,
): Promise<PageBuildResult> {
  const content = await renderPageContent(ctx, page.id, 0);
  const propertyResult = await mapProperties(ctx, page.properties ?? {});
  const parent = await mapParent(ctx, page.parent);
  const title = titleFromPage(page) ?? 'Untitled';
  const pageUrl = page.url ?? notionUrlFromId(page.id);
  const files = uniqueFiles([...content.files, ...propertyResult.files, ...mapPageFiles(page)]);
  const links = uniqueLinks([...content.links, ...propertyResult.links]);
  const childPages = uniqueRefs(content.childPages);
  const childDatabases = uniqueRefs([...content.childDatabases, ...propertyResult.childDatabases]);
  const relatedPages = uniqueRefs([...content.relatedPages, ...propertyResult.relatedPages]);
  const createdBy = toPersonRef(page.created_by);
  const updatedBy = toPersonRef(page.last_edited_by);
  const people = uniquePeople([
    ...propertyResult.people,
    ...(createdBy ? [createdBy] : []),
    ...(updatedBy ? [updatedBy] : []),
  ]);
  const mentionedPeople = uniquePeople([
    ...content.mentionedPeople,
    ...propertyResult.mentionedPeople,
  ]);
  const properties = uniqueProperties(propertyResult.properties);
  const body = renderPageBody({
    title,
    url: pageUrl,
    publicUrl: page.public_url ?? undefined,
    parent,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    createdBy,
    updatedBy,
    people,
    mentionedPeople,
    properties,
    content: content.markdown,
    files,
    links,
    childPages,
    childDatabases,
    relatedPages,
  });

  return {
    record: withoutUndefined({
      id: page.id,
      body,
      title,
      url: pageUrl,
      public_url: page.public_url ?? undefined,
      parent,
      created_at: page.created_time ?? '',
      updated_at: page.last_edited_time ?? page.created_time ?? '',
      created_by: createdBy,
      updated_by: updatedBy,
      participants: collectParticipants(people, mentionedPeople),
      people: people.length > 0 ? people : undefined,
      mentioned_people: mentionedPeople.length > 0 ? mentionedPeople : undefined,
      content: content.markdown || undefined,
      properties: properties.length > 0 ? properties : undefined,
      files: files.length > 0 ? files : undefined,
      links: links.length > 0 ? links : undefined,
      child_pages: childPages.length > 0 ? childPages : undefined,
      child_databases: childDatabases.length > 0 ? childDatabases : undefined,
      related_pages: relatedPages.length > 0 ? relatedPages : undefined,
    }),
    pageIds: [...new Set([...content.pageIds, ...propertyResult.pageIds])],
    databaseIds: [...new Set([...content.databaseIds, ...propertyResult.databaseIds])],
    dataSourceIds: [...new Set(content.dataSourceIds)],
  };
}

function collectParticipants(people: NotionPerson[], mentionedPeople: NotionPerson[]): string[] {
  return [...new Set([...people, ...mentionedPeople].map((person) => person.identifier))].sort();
}

function renderPageBody(input: {
  title: string;
  url: string;
  publicUrl: string | undefined;
  parent: NotionParent;
  createdAt: string | undefined;
  updatedAt: string | undefined;
  createdBy: NotionPerson | undefined;
  updatedBy: NotionPerson | undefined;
  people: NotionPerson[];
  mentionedPeople: NotionPerson[];
  properties: NotionProperty[];
  content: string;
  files: NotionFile[];
  links: NotionLink[];
  childPages: NotionReference[];
  childDatabases: NotionReference[];
  relatedPages: NotionReference[];
}): string {
  const lines = [
    `# ${input.title}`,
    '',
    `- URL: ${input.url}`,
    input.publicUrl ? `- Public URL: ${input.publicUrl}` : undefined,
    `- Parent: ${renderParent(input.parent)}`,
    input.createdAt ? `- Created: ${input.createdAt}` : undefined,
    input.updatedAt ? `- Last updated: ${input.updatedAt}` : undefined,
    input.createdBy ? `- Created by: ${renderPerson(input.createdBy)}` : undefined,
    input.updatedBy ? `- Last updated by: ${renderPerson(input.updatedBy)}` : undefined,
  ].filter((line): line is string => typeof line === 'string');

  appendProperties(lines, input.properties);
  appendPeople(lines, 'People', input.people);
  appendPeople(lines, 'Mentioned people', input.mentionedPeople);
  appendReferences(lines, 'Child pages', input.childPages);
  appendReferences(lines, 'Child databases', input.childDatabases);
  appendReferences(lines, 'Related pages', input.relatedPages);
  appendFiles(lines, input.files);
  appendLinks(lines, input.links);

  if (input.content) {
    lines.push('', '## Content', '', input.content);
  }

  return lines.join('\n').trim();
}

function appendProperties(lines: string[], properties: NotionProperty[]): void {
  if (properties.length === 0) {
    return;
  }

  lines.push('', '## Properties');
  for (const property of properties) {
    lines.push(`- ${property.name}: ${property.value}`);
  }
}

function appendPeople(lines: string[], label: string, people: NotionPerson[]): void {
  if (people.length === 0) {
    return;
  }

  lines.push('', `## ${label}`);
  for (const person of people) {
    lines.push(`- ${renderPerson(person)}`);
  }
}

function appendReferences(lines: string[], label: string, refs: NotionReference[]): void {
  if (refs.length === 0) {
    return;
  }

  lines.push('', `## ${label}`);
  for (const ref of refs) {
    lines.push(`- ${renderReferenceText(ref)}`);
  }
}

function appendFiles(lines: string[], files: NotionFile[]): void {
  if (files.length === 0) {
    return;
  }

  lines.push('', '## Files');
  for (const file of files) {
    lines.push(`- ${renderFileSummary(file)}`);
  }
}

function appendLinks(lines: string[], links: NotionLink[]): void {
  if (links.length === 0) {
    return;
  }

  lines.push('', '## Links');
  for (const link of links) {
    lines.push(`- ${link.text ? `${link.text}: ` : ''}${link.url}`);
  }
}

function renderParent(parent: NotionParent): string {
  const label = parent.title ?? parent.type.replace(/_/g, ' ');
  return parent.url ? `${label} (${parent.url})` : label;
}
