import { describe, expect, it } from 'bun:test';
import { legacyDefaultNetworkingResourcesInState } from './aws-terraform.ts';

describe('Terraform state helpers', () => {
  it('finds legacy default-networking resources in state listings', () => {
    expect(
      legacyDefaultNetworkingResourcesInState(
        [
          'aws_default_subnet.app',
          'aws_eip.app',
          'aws_route.ipv6_default',
          'aws_vpc_ipv6_cidr_block_association.default',
        ].join('\n'),
      ),
    ).toEqual([
      'aws_default_subnet.app',
      'aws_route.ipv6_default',
      'aws_vpc_ipv6_cidr_block_association.default',
    ]);
  });

  it('ignores resources that can stay managed', () => {
    expect(legacyDefaultNetworkingResourcesInState('aws_eip.app\naws_instance.app')).toEqual([]);
  });
});
