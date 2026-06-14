import { describe, expect, it } from 'bun:test';
import { hasTaintedResource } from './aws-terraform.ts';

describe('Terraform state helpers', () => {
  it('detects tainted managed resources', () => {
    const state = JSON.stringify({
      resources: [
        {
          mode: 'managed',
          type: 'aws_default_subnet',
          name: 'app',
          instances: [{ status: 'tainted' }],
        },
      ],
    });

    expect(hasTaintedResource(state, 'aws_default_subnet', 'app')).toBe(true);
  });

  it('does not treat healthy resources as tainted', () => {
    const state = JSON.stringify({
      resources: [
        {
          mode: 'managed',
          type: 'aws_default_subnet',
          name: 'app',
          instances: [{}],
        },
      ],
    });

    expect(hasTaintedResource(state, 'aws_default_subnet', 'app')).toBe(false);
  });

  it('ignores missing resources', () => {
    expect(hasTaintedResource(JSON.stringify({ resources: [] }), 'aws_default_subnet', 'app')).toBe(
      false,
    );
  });
});
