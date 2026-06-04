import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { NangoSyncMock } from '../../test-support/nango-sync-mock.js';
import createSync, { type NangoSyncLocal } from '../syncs/pages.js';

const NotionPageModel = createSync.models.NotionPage;
const EXPECTED_PAGE_COUNT = 4;
type SavedNotionPage = ReturnType<(typeof NotionPageModel)['parse']>;

function asNango(mock: NangoSyncMock): NangoSyncLocal {
  return mock as unknown as NangoSyncLocal;
}

describe('notion pages sync', () => {
  const createTestContext = (name = 'pages') => {
    const nangoMock = new NangoSyncMock({
      dirname: __dirname,
      name,
    });

    return {
      nangoMock: asNango(nangoMock),
      batchSaveSpy: spyOn(nangoMock, 'batchSave'),
    };
  };

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it('flattens page content without flattening nested or referenced pages', async () => {
    const { nangoMock, batchSaveSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const savedPages = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'NotionPage' ? call[0] : [],
    );
    const pages = JSON.parse(JSON.stringify(savedPages)) as SavedNotionPage[];
    const root = pageByTitle(pages, 'Company Home');
    const child = pageByTitle(pages, 'Nested Plan');
    const related = pageByTitle(pages, 'Spec Page');
    const databaseRow = pageByTitle(pages, 'DB Row');
    const allJson = JSON.stringify(pages);

    expect(savedPages).toHaveLength(EXPECTED_PAGE_COUNT);
    for (const page of pages) {
      expect(NotionPageModel.parse(page)).toStrictEqual(page);
    }

    expect(root.body).toContain('# Company Home');
    expect(root.body).toContain('[the roadmap](https://example.com/roadmap)');
    expect(root.body).toContain('Toggle: Launch checklist');
    expect(root.body).toContain('- [x] QA nested toggles');
    expect(root.body).toContain('```typescript\nconst ready = true;\n```');
    expect(root.created_at).toBe('2026-01-01T10:00:00.000Z');
    expect(root.created_by).toStrictEqual({ identifier: 'maya@example.com' });
    expect(root.updated_by).toStrictEqual({ identifier: 'alex@example.com' });
    expect(root.people).toEqual(
      expect.arrayContaining([
        { identifier: 'maya@example.com' },
        { identifier: 'alex@example.com' },
      ]),
    );
    expect(root.mentioned_people).toStrictEqual([{ identifier: 'alex@example.com' }]);
    expect(root.body).toContain('## People');
    expect(root.body).toContain('## Mentioned people');
    expect(root.body).toContain('maya@example.com');
    expect(root.body).toContain('alex@example.com');
    expect(root.body).not.toContain('user-1');
    expect(root.body).not.toContain('user-2');
    expect(root.body).toContain(
      '[Nested Plan](https://www.notion.so/33333333333333333333333333333333)',
    );
    expect(root.body).toContain(
      '[Projects DB](https://www.notion.so/66666666666666666666666666666666)',
    );
    expect(root.body).toContain('https://example.com/architecture.png');
    expect(root.body).not.toContain('Child page body SHOULD NOT appear in parent');
    expect(root.child_pages).toStrictEqual([
      {
        title: 'Nested Plan',
        url: 'https://www.notion.so/33333333333333333333333333333333',
      },
    ]);
    expect(root.related_pages).toStrictEqual([
      {
        title: 'Spec Page',
        url: 'https://www.notion.so/Spec-Page-44444444444444444444444444444444',
      },
    ]);
    expect(root.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'file', name: 'signed-export.pdf' }),
        expect.objectContaining({
          kind: 'image',
          name: 'architecture.png',
          url: 'https://example.com/architecture.png',
        }),
      ]),
    );

    expect(child.body).toContain('Child page body SHOULD NOT appear in parent');
    expect(related.body).toContain('Spec details live here');
    expect(databaseRow.parent).toStrictEqual({
      type: 'data_source',
      title: 'Projects source',
      url: 'https://www.notion.so/Projects-66666666666666666666666666666666',
    });
    expect(databaseRow.properties).toEqual(
      expect.arrayContaining([
        { name: 'Status', value: 'Done' },
        {
          name: 'Related',
          value: '[Spec Page](https://www.notion.so/Spec-Page-44444444444444444444444444444444)',
        },
        {
          name: 'Assets',
          value: 'private-export.pdf, brand-guide.pdf (https://example.com/brand-guide.pdf)',
        },
      ]),
    );
    expect(databaseRow.related_pages).toStrictEqual([
      {
        title: 'Spec Page',
        url: 'https://www.notion.so/Spec-Page-44444444444444444444444444444444',
      },
    ]);

    expect(allJson).not.toContain('secure.notion-static.com');
    expect(allJson).not.toContain('X-Amz-Expires');
    expect(allJson).not.toContain('expiry_time');
    expect(allJson).not.toContain('file_upload');
    expect(allJson).not.toContain('"blocks"');
    expect(allJson).not.toContain('"raw"');
  });
});

function pageByTitle(pages: SavedNotionPage[], title: string): SavedNotionPage {
  const page = pages.find((item) => item.title === title);

  expect(page).toBeDefined();
  return page as SavedNotionPage;
}
