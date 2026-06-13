import { describe, expect, it } from 'bun:test';
import { parseSelectionAnswer } from './selection.ts';

const options = [
  { id: 'notion', label: 'Notion' },
  { id: 'slack', label: 'Slack' },
  { id: 'github', label: 'GitHub' },
];

describe('parseSelectionAnswer', () => {
  it('accepts all options', () => {
    expect(parseSelectionAnswer('all', options)).toEqual(['notion', 'slack', 'github']);
  });

  it('accepts comma-separated ids', () => {
    expect(parseSelectionAnswer('notion,slack', options)).toEqual(['notion', 'slack']);
  });

  it('accepts numbered selections', () => {
    expect(parseSelectionAnswer('1, 3', options)).toEqual(['notion', 'github']);
  });

  it('dedupes selections', () => {
    expect(parseSelectionAnswer('notion,1,notion', options)).toEqual(['notion']);
  });

  it('rejects unknown selections', () => {
    expect(() => parseSelectionAnswer('unknown', options)).toThrow('Unknown selection: unknown');
  });
});
