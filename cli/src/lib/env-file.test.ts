import { describe, expect, it } from 'bun:test';

import { parseEnv } from './env-file.ts';

describe('parseEnv', () => {
  it('reads assignments while ignoring comments and malformed lines', () => {
    const values = parseEnv(`
# comment
PLAIN=value
DOUBLE_QUOTED="two words"
SINGLE_QUOTED='three words'
EMPTY=
not an assignment
`);

    expect(values).toEqual({
      DOUBLE_QUOTED: 'two words',
      EMPTY: '',
      PLAIN: 'value',
      SINGLE_QUOTED: 'three words',
    });
  });
});
