import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import createSync from '../syncs/threads.js';
import { NangoSyncMock } from './nango-sync-mock.js';

describe('slack threads tests', () => {
    const models = 'SlackThread'.split(',');

    const createTestContext = () => {
        const nangoMock = new NangoSyncMock({
            dirname: __dirname,
            name: 'threads'
        });

        return {
            nangoMock,
            batchSaveSpy: spyOn(nangoMock, 'batchSave')
        };
    };

    afterEach(() => {
        mock.clearAllMocks();
        mock.restore();
    });

    it('should build self-contained Slack thread records', async () => {
        const { nangoMock, batchSaveSpy } = createTestContext();

        await createSync.exec(nangoMock);

        for (const model of models) {
            const expectedBatchSaveData = await nangoMock.getBatchSaveData(model);

            const spiedData = batchSaveSpy.mock.calls.flatMap((call) => {
                if (call[1] === model) {
                    return call[0];
                }

                return [];
            });

            const spied = JSON.parse(JSON.stringify(spiedData));

            expect(spied).toStrictEqual(expectedBatchSaveData);
        }
    });
});
