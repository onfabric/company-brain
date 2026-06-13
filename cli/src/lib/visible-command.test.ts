import { describe, expect, it } from 'bun:test';
import { renderCommand } from './visible-command.ts';

describe('renderCommand', () => {
  it('quotes shell-sensitive args and redacts secrets', () => {
    expect(
      renderCommand(
        ['aws', 'ssm', 'put-parameter', '--value', 'very secret value'],
        ['very secret value'],
      ),
    ).toBe("aws ssm put-parameter --value '[redacted]'");
  });
});
