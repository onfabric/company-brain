import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import createSync from '../syncs/threads.js';
import { NangoSyncMock } from './nango-sync-mock.js';

const SlackThreadModel = createSync.models.SlackThread;

describe('slack threads tests', () => {
    const createTestContext = (name = 'threads') => {
        const nangoMock = new NangoSyncMock({
            dirname: __dirname,
            name
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

    it('should build readable Slack thread records', async () => {
        const { nangoMock, batchSaveSpy } = createTestContext();

        await createSync.exec(nangoMock);

        const savedThreads = batchSaveSpy.mock.calls.flatMap((call) => (call[1] === 'SlackThread' ? call[0] : []));
        const [thread, standalone] = JSON.parse(JSON.stringify(savedThreads));

        expect(savedThreads).toHaveLength(2);
        expectSlackThreadSchema(thread);
        expectSlackThreadSchema(standalone);
        expect(thread).toMatchObject({
            id: 'C123-1700000100.123456',
            channel: {
                id: 'C123',
                name: 'engineering',
                type: 'public_channel',
                is_private: false
            },
            messages: [
                {
                    id: 'C123-1700000100.123456',
                    author: { id: 'U1', kind: 'user', name: 'Alice' },
                    text: 'Deploy check @Bob Builder deploy notes (https://example.com/deploy)',
                    mentions: [{ id: 'U2', kind: 'user', name: 'Bob Builder' }],
                    reactions: [{ name: 'white_check_mark', actors: [{ id: 'U2', kind: 'user', name: 'Bob Builder' }] }]
                },
                {
                    id: 'C123-1700000105.654321',
                    author: { id: 'U2', kind: 'user', name: 'Bob Builder' },
                    text: '@Alice looks good',
                    mentions: [{ id: 'U1', kind: 'user', name: 'Alice' }]
                },
                {
                    id: 'C123-1700000110.111222',
                    author: { id: 'B99', kind: 'bot', name: 'DeployBot' },
                    text: 'Deployment finished',
                    files: [{ id: 'F1', actor: { id: 'B99', kind: 'bot', name: 'DeployBot' } }]
                }
            ]
        });
        expect(standalone).toMatchObject({
            id: 'C123-1700000000.500000',
            messages: [
                {
                    author: { id: 'U2', kind: 'user', name: 'Bob Builder' },
                    text: 'Standalone note for @Alice http://example.com/report',
                    reactions: [{ name: '+1', actors: [{ id: 'U1', kind: 'user', name: 'Alice' }] }]
                }
            ]
        });
        const messageJson = JSON.stringify(thread.messages);
        expect(typeof thread.body).toBe('string');
        expect(thread.body.startsWith('Channel: #engineering')).toBe(true);
        expect(thread.body.includes('Alice - 2023-11-14T22:15:00.123Z')).toBe(true);
        expect(thread.body.includes('Reactions: white_check_mark by Bob Builder')).toBe(true);
        expect(messageJson.includes('blocks')).toBe(false);
        expect(messageJson.includes('attachments')).toBe(false);
        expect(thread.body.includes('<@')).toBe(false);
        expect('source' in thread).toBe(false);
        expect('counts' in thread).toBe(false);
        expect('participants' in thread).toBe(false);
        expect('mentioned_people' in thread).toBe(false);
        expect('title' in thread).toBe(false);
        expect(messageJson.includes('"source"')).toBe(false);
        expect(messageJson.includes('"count"')).toBe(false);
    });

    it('should map a realistic Slack planning thread to the SlackThread schema', async () => {
        const { nangoMock, batchSaveSpy } = createTestContext('realistic-threads');

        await createSync.exec(nangoMock);

        const savedThreads = batchSaveSpy.mock.calls.flatMap((call) => (call[1] === 'SlackThread' ? call[0] : []));
        const [thread] = JSON.parse(JSON.stringify(savedThreads));

        expect(savedThreads).toHaveLength(1);
        expectSlackThreadSchema(thread);
        expect(thread).toStrictEqual({
            id: 'C999-1761923700.772849',
            body:
                'Channel: #product-launch\n' +
                'Started: 2025-10-31T15:15:00.772Z\n' +
                '\n' +
                'Maya Chen - 2025-10-31T15:15:00.772Z\n' +
                '*Launch planning for Monday-Wednesday:*\n' +
                '• Website @Alex Rivera, needed by EOD Tuesday\n' +
                '• QA pass on onboarding @Priya Shah\n' +
                '• Retrieval demo plan @Priya Shah\n' +
                'Docs: launch plan (https://company.example/launch-plan)\n' +
                'Keeping this in #product-launch. Anything else?\n' +
                'Reactions: +1 by Alex Rivera, Priya Shah\n' +
                '\n' +
                'Alex Rivera - 2025-10-31T15:16:31.682Z\n' +
                "I'm blocked on final copy but can ship by Tuesday. @Maya Chen please confirm homepage hero.\n" +
                'Reactions: eyes by Maya Chen\n' +
                '\n' +
                'Priya Shah - 2025-10-31T15:18:04.123Z\n' +
                "QA plan is here: https://company.example/qa-checklist\nI'll cover onboarding and retrieval.\n" +
                'Files: qa-checklist.pdf (https://example.slack.com/files/FQA1)\n' +
                '\n' +
                'LaunchBot - 2025-10-31T15:19:10.000Z\n' +
                'Reminder set for Tuesday 16:00',
            channel: {
                id: 'C999',
                team_id: 'T999',
                type: 'public_channel',
                name: 'product-launch',
                is_private: false
            },
            created_at: '2025-10-31T15:15:00.772Z',
            updated_at: '2025-10-31T15:19:10.000Z',
            messages: [
                {
                    id: 'C999-1761923700.772849',
                    created_at: '2025-10-31T15:15:00.772Z',
                    author: { id: 'U111', kind: 'user', name: 'Maya Chen' },
                    text:
                        '*Launch planning for Monday-Wednesday:*\n' +
                        '• Website @Alex Rivera, needed by EOD Tuesday\n' +
                        '• QA pass on onboarding @Priya Shah\n' +
                        '• Retrieval demo plan @Priya Shah\n' +
                        'Docs: launch plan (https://company.example/launch-plan)\n' +
                        'Keeping this in #product-launch. Anything else?',
                    mentions: [
                        { id: 'U222', kind: 'user', name: 'Alex Rivera' },
                        { id: 'U333', kind: 'user', name: 'Priya Shah' }
                    ],
                    reactions: [
                        {
                            name: '+1',
                            actors: [
                                { id: 'U222', kind: 'user', name: 'Alex Rivera' },
                                { id: 'U333', kind: 'user', name: 'Priya Shah' }
                            ]
                        }
                    ],
                    links: [{ url: 'https://company.example/launch-plan', label: 'launch plan' }]
                },
                {
                    id: 'C999-1761923791.682979',
                    created_at: '2025-10-31T15:16:31.682Z',
                    author: { id: 'U222', kind: 'user', name: 'Alex Rivera' },
                    text: "I'm blocked on final copy but can ship by Tuesday. @Maya Chen please confirm homepage hero.",
                    mentions: [{ id: 'U111', kind: 'user', name: 'Maya Chen' }],
                    reactions: [{ name: 'eyes', actors: [{ id: 'U111', kind: 'user', name: 'Maya Chen' }] }]
                },
                {
                    id: 'C999-1761923884.123456',
                    created_at: '2025-10-31T15:18:04.123Z',
                    author: { id: 'U333', kind: 'user', name: 'Priya Shah' },
                    text: "QA plan is here: https://company.example/qa-checklist\nI'll cover onboarding and retrieval.",
                    files: [
                        {
                            id: 'FQA1',
                            name: 'qa-checklist.pdf',
                            title: 'qa-checklist.pdf',
                            mimetype: 'application/pdf',
                            filetype: 'pdf',
                            url_private: 'https://files.slack.com/files-pri/T999-FQA1/qa-checklist.pdf',
                            permalink: 'https://example.slack.com/files/FQA1',
                            size: 512000,
                            created_at: '2025-10-31T15:17:55.000Z',
                            actor: { id: 'U333', kind: 'user', name: 'Priya Shah' }
                        }
                    ],
                    links: [{ url: 'https://company.example/qa-checklist' }]
                },
                {
                    id: 'C999-1761923950.000000',
                    created_at: '2025-10-31T15:19:10.000Z',
                    author: { id: 'B999', kind: 'bot', name: 'LaunchBot' },
                    text: 'Reminder set for Tuesday 16:00'
                }
            ]
        });
    });
});

function expectSlackThreadSchema(value: unknown): void {
    expect(SlackThreadModel.parse(value)).toStrictEqual(value);
}
