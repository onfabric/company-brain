import type {
  RawFormulaValue,
  RawPageProperty,
  RawRollupValue,
  RenderedRichText,
} from './api-types.js';
import type { SyncContext, UserDirectory } from './context.js';
import { mapFile, renderFileSummary } from './files.js';
import type {
  NotionFile,
  NotionLink,
  NotionPerson,
  NotionProperty,
  NotionReference,
} from './models.js';
import { referenceForPageId } from './references.js';
import {
  renderPerson,
  renderReferenceText,
  renderRichText,
  toPersonRef,
  userName,
} from './rich-text.js';
import { isExpiringUrl, isString, renderDateRange } from './utils.js';

type PropertyMapResult = {
  properties: NotionProperty[];
  files: NotionFile[];
  links: NotionLink[];
  people: NotionPerson[];
  mentionedPeople: NotionPerson[];
  relatedPages: NotionReference[];
  childDatabases: NotionReference[];
  pageIds: string[];
  databaseIds: string[];
};

export async function mapProperties(
  ctx: SyncContext,
  properties: Record<string, RawPageProperty>,
): Promise<PropertyMapResult> {
  const mappedProperties: NotionProperty[] = [];
  const files: NotionFile[] = [];
  const links: NotionLink[] = [];
  const people: NotionPerson[] = [];
  const mentionedPeople: NotionPerson[] = [];
  const relatedPages: NotionReference[] = [];
  const childDatabases: NotionReference[] = [];
  const pageIds: string[] = [];
  const databaseIds: string[] = [];

  for (const [name, property] of Object.entries(properties)) {
    const mapped = await mapPropertyValue(ctx, property);
    if (mapped.value) {
      mappedProperties.push({ name, value: mapped.value });
    }
    files.push(...mapped.files);
    links.push(...mapped.links);
    people.push(...mapped.people);
    mentionedPeople.push(...mapped.mentionedPeople);
    relatedPages.push(...mapped.relatedPages);
    childDatabases.push(...mapped.childDatabases);
    pageIds.push(...mapped.pageIds);
    databaseIds.push(...mapped.databaseIds);
  }

  return {
    properties: mappedProperties,
    files,
    links,
    people,
    mentionedPeople,
    relatedPages,
    childDatabases,
    pageIds,
    databaseIds,
  };
}

async function mapPropertyValue(
  ctx: SyncContext,
  property: RawPageProperty,
): Promise<Omit<PropertyMapResult, 'properties'> & { value: string }> {
  const files: NotionFile[] = [];
  const links: NotionLink[] = [];
  const people: NotionPerson[] = [];
  const mentionedPeople: NotionPerson[] = [];
  const relatedPages: NotionReference[] = [];
  const childDatabases: NotionReference[] = [];
  const pageIds: string[] = [];
  const databaseIds: string[] = [];
  let value = '';

  switch (property.type) {
    case 'title': {
      const richText = renderRichText(property.title, ctx.userEmailsById);
      mergePropertyRichText(
        richText,
        links,
        mentionedPeople,
        relatedPages,
        childDatabases,
        pageIds,
        databaseIds,
      );
      value = richText.text;
      break;
    }
    case 'rich_text': {
      const richText = renderRichText(property.rich_text, ctx.userEmailsById);
      mergePropertyRichText(
        richText,
        links,
        mentionedPeople,
        relatedPages,
        childDatabases,
        pageIds,
        databaseIds,
      );
      value = richText.text;
      break;
    }
    case 'number':
      value =
        property.number === null || property.number === undefined ? '' : String(property.number);
      break;
    case 'checkbox':
      value = property.checkbox ? 'true' : 'false';
      break;
    case 'select':
      value = property.select?.name ?? '';
      break;
    case 'multi_select':
      value = (property.multi_select ?? [])
        .map((item) => item.name)
        .filter(isString)
        .join(', ');
      break;
    case 'status':
      value = property.status?.name ?? '';
      break;
    case 'date':
      value = renderDateRange(property.date);
      break;
    case 'email':
      value = property.email ?? '';
      if (property.email) {
        links.push({ url: `mailto:${property.email}`, text: property.email });
      }
      break;
    case 'url':
      value = property.url ?? '';
      if (property.url && !isExpiringUrl(property.url)) {
        links.push({ url: property.url });
      }
      break;
    case 'phone_number':
      value = property.phone_number ?? '';
      break;
    case 'people':
      people.push(
        ...(property.people ?? [])
          .map((user) => toPersonRef(user, ctx.userEmailsById))
          .filter(isPerson),
      );
      value = people.map(renderPerson).join(', ');
      break;
    case 'created_by':
      if (property.created_by) {
        const person = toPersonRef(property.created_by, ctx.userEmailsById);
        if (person) {
          people.push(person);
          value = renderPerson(person);
        }
      }
      break;
    case 'last_edited_by':
      if (property.last_edited_by) {
        const person = toPersonRef(property.last_edited_by, ctx.userEmailsById);
        if (person) {
          people.push(person);
          value = renderPerson(person);
        }
      }
      break;
    case 'created_time':
      value = property.created_time ?? '';
      break;
    case 'last_edited_time':
      value = property.last_edited_time ?? '';
      break;
    case 'files':
      for (const file of property.files ?? []) {
        const mappedFile = mapFile('file', file);
        if (mappedFile) {
          files.push(mappedFile);
          if (mappedFile.url) {
            links.push({ url: mappedFile.url, text: mappedFile.name });
          }
        }
      }
      value = files.map(renderFileSummary).join(', ');
      break;
    case 'relation': {
      const refs: NotionReference[] = [];
      for (const relation of property.relation ?? []) {
        if (!relation.id) {
          continue;
        }
        const ref = await referenceForPageId(ctx, relation.id);
        refs.push(ref);
        relatedPages.push(ref);
        pageIds.push(relation.id);
      }
      value = refs.map(renderReferenceText).join(', ');
      break;
    }
    case 'formula':
      value = renderFormula(property.formula);
      break;
    case 'rollup':
      value = renderRollup(property.rollup, ctx.userEmailsById);
      break;
    case 'unique_id':
      value =
        typeof property.unique_id?.number === 'number'
          ? `${property.unique_id.prefix ?? ''}${property.unique_id.number}`
          : '';
      break;
    case 'verification':
      value = renderVerification(property.verification, ctx.userEmailsById);
      break;
    default:
      value = '';
  }

  return {
    value,
    files,
    links,
    people,
    mentionedPeople,
    relatedPages,
    childDatabases,
    pageIds,
    databaseIds,
  };
}

function mergePropertyRichText(
  richText: RenderedRichText,
  links: NotionLink[],
  mentionedPeople: NotionPerson[],
  relatedPages: NotionReference[],
  childDatabases: NotionReference[],
  pageIds: string[],
  databaseIds: string[],
): void {
  links.push(...richText.links);
  mentionedPeople.push(...richText.mentionedPeople);
  relatedPages.push(...richText.relatedPages);
  childDatabases.push(...richText.childDatabases);
  pageIds.push(...richText.pageIds);
  databaseIds.push(...richText.databaseIds);
}

function isPerson(value: NotionPerson | undefined): value is NotionPerson {
  return Boolean(value);
}

function renderFormula(formula: RawFormulaValue | undefined): string {
  if (!formula) {
    return '';
  }

  switch (formula.type) {
    case 'string':
      return formula.string ?? '';
    case 'number':
      return formula.number === null || formula.number === undefined ? '' : String(formula.number);
    case 'boolean':
      return formula.boolean === null || formula.boolean === undefined
        ? ''
        : String(formula.boolean);
    case 'date':
      return renderDateRange(formula.date);
    default:
      return '';
  }
}

function renderRollup(rollup: RawRollupValue | undefined, directory: UserDirectory): string {
  if (!rollup) {
    return '';
  }

  switch (rollup.type) {
    case 'array':
      return (rollup.array ?? [])
        .map((item) => renderSimplePropertyValue(item, directory))
        .filter(Boolean)
        .join(', ');
    case 'number':
      return rollup.number === null || rollup.number === undefined ? '' : String(rollup.number);
    case 'date':
      return renderDateRange(rollup.date);
    default:
      return '';
  }
}

function renderSimplePropertyValue(property: RawPageProperty, directory: UserDirectory): string {
  switch (property.type) {
    case 'title':
      return renderRichText(property.title, directory).text;
    case 'rich_text':
      return renderRichText(property.rich_text, directory).text;
    case 'number':
      return property.number === null || property.number === undefined
        ? ''
        : String(property.number);
    case 'checkbox':
      return property.checkbox ? 'true' : 'false';
    case 'select':
      return property.select?.name ?? '';
    case 'status':
      return property.status?.name ?? '';
    case 'date':
      return renderDateRange(property.date);
    default:
      return '';
  }
}

function renderVerification(
  verification: RawPageProperty['verification'],
  directory: UserDirectory,
): string {
  if (!verification) {
    return '';
  }

  return [
    verification.state,
    verification.verified_by
      ? `by ${userName(verification.verified_by, directory) ?? 'unknown'}`
      : undefined,
    renderDateRange(verification.date),
  ]
    .filter(isString)
    .join(' ');
}
