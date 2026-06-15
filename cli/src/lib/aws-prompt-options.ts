export type AwsPromptOption<Value extends number | string> = {
  value: Value;
  label: string;
  hint: string;
};

export const DEFAULT_AWS_REGION = 'eu-west-2';
export const DEFAULT_AWS_INSTANCE_TYPE = 't3.large';
export const DEFAULT_ROOT_VOLUME_SIZE_GB = 24;
export const DEFAULT_DATA_VOLUME_SIZE_GB = 100;

export const AWS_REGION_OPTIONS = [
  { value: 'eu-west-2', label: 'eu-west-2', hint: 'Europe, London. Best default for Fabric.' },
  { value: 'eu-west-1', label: 'eu-west-1', hint: 'Europe, Ireland.' },
  { value: 'eu-central-1', label: 'eu-central-1', hint: 'Europe, Frankfurt.' },
  { value: 'eu-west-3', label: 'eu-west-3', hint: 'Europe, Paris.' },
  { value: 'eu-north-1', label: 'eu-north-1', hint: 'Europe, Stockholm.' },
  { value: 'us-east-1', label: 'us-east-1', hint: 'US East, N. Virginia.' },
  { value: 'us-east-2', label: 'us-east-2', hint: 'US East, Ohio.' },
  { value: 'us-west-2', label: 'us-west-2', hint: 'US West, Oregon.' },
] as const satisfies AwsPromptOption<string>[];

export const AWS_INSTANCE_TYPE_OPTIONS = [
  {
    value: 't3.medium',
    label: 't3.medium',
    hint: '2 vCPU, 4 GiB RAM. Cheapest smoke test; may be tight.',
  },
  {
    value: 't3.large',
    label: 't3.large',
    hint: '2 vCPU, 8 GiB RAM. Recommended small deployment.',
  },
  {
    value: 't3.xlarge',
    label: 't3.xlarge',
    hint: '4 vCPU, 16 GiB RAM. More headroom for syncs and Elasticsearch.',
  },
] as const satisfies AwsPromptOption<string>[];

export const AWS_ROOT_VOLUME_SIZE_OPTIONS = [
  { value: 16, label: '16 GB', hint: 'Minimum-ish OS disk; tight for Docker layers.' },
  { value: 24, label: '24 GB', hint: 'Recommended OS disk; data stays on the persistent volume.' },
  { value: 32, label: '32 GB', hint: 'Extra room for image layers and package cache.' },
  { value: 50, label: '50 GB', hint: 'Conservative; current Terraform default.' },
] as const satisfies AwsPromptOption<number>[];

export const AWS_DATA_VOLUME_SIZE_OPTIONS = [
  { value: 50, label: '50 GB', hint: 'Small test data volume.' },
  { value: 100, label: '100 GB', hint: 'Recommended starting point for hosted Company Brain.' },
  { value: 200, label: '200 GB', hint: 'More room for records, Elasticsearch, and backups.' },
  { value: 500, label: '500 GB', hint: 'Larger long-lived deployment.' },
] as const satisfies AwsPromptOption<number>[];

export function optionsWithCurrent<Value extends number | string>(
  options: readonly AwsPromptOption<Value>[],
  current: Value | undefined,
): AwsPromptOption<Value>[] {
  if (current === undefined || options.some((option) => option.value === current)) {
    return [...options];
  }

  return [
    {
      value: current,
      label: `${current}`,
      hint: 'Current value from saved cloud config.',
    },
    ...options,
  ];
}
