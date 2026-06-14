import { describe, expect, it } from 'bun:test';

import { SYNC_SPECS } from './catalog.js';
import { buildDeployCommands, stripWrapperArgs } from './deploy-syncs.js';

describe('stripWrapperArgs', () => {
  it('removes the environment, --only, and --list wrapper args', () => {
    expect(
      stripWrapperArgs(['dev', '--only', 'notion,slack', '--list', '--auto-confirm'], 'dev'),
    ).toEqual(['--auto-confirm']);
  });

  it('removes inline --only= values', () => {
    expect(stripWrapperArgs(['dev', '--only=notion', '--no-interactive'], 'dev')).toEqual([
      '--no-interactive',
    ]);
  });
});

describe('buildDeployCommands', () => {
  it('builds one nango deploy command per selected integration', () => {
    const selected = SYNC_SPECS.filter((sync) => sync.integrationId === 'notion');

    expect(buildDeployCommands(selected, 'dev', ['--auto-confirm'])).toEqual([
      ['bun', 'run', 'nango', 'deploy', 'dev', '--integration', 'notion', '--auto-confirm'],
    ]);
  });
});
