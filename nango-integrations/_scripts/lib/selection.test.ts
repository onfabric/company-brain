import { describe, expect, it } from 'bun:test';

import { parseSelection } from './selection.js';

const ids = ['notion', 'slack', 'github'];

describe('parseSelection', () => {
  it('selects every id', () => {
    expect(parseSelection('all', ids)).toEqual(['notion', 'slack', 'github']);
  });

  it('selects nothing for "none"', () => {
    expect(parseSelection('none', ids)).toEqual([]);
  });

  it('accepts comma-separated ids', () => {
    expect(parseSelection('notion, slack', ids)).toEqual(['notion', 'slack']);
  });

  it('accepts 1-based numbers', () => {
    expect(parseSelection('1, 3', ids)).toEqual(['notion', 'github']);
  });

  it('dedupes ids and numbers that resolve to the same selection', () => {
    expect(parseSelection('notion,1,notion', ids)).toEqual(['notion']);
  });

  it('rejects unknown selections', () => {
    expect(() => parseSelection('unknown', ids)).toThrow('Unknown selection: unknown');
  });
});
