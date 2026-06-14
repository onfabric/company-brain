import { describe, expect, it } from 'bun:test';
import {
  AWS_DATA_VOLUME_SIZE_OPTIONS,
  AWS_INSTANCE_TYPE_OPTIONS,
  AWS_REGION_OPTIONS,
  AWS_ROOT_VOLUME_SIZE_OPTIONS,
  DEFAULT_AWS_INSTANCE_TYPE,
  DEFAULT_AWS_REGION,
  DEFAULT_DATA_VOLUME_SIZE_GB,
  DEFAULT_ROOT_VOLUME_SIZE_GB,
  optionsWithCurrent,
} from './aws-prompt-options.ts';

describe('AWS prompt options', () => {
  it('keeps defaults inside the curated picker lists', () => {
    expect(AWS_REGION_OPTIONS.map((option) => option.value)).toContain(DEFAULT_AWS_REGION);
    expect(AWS_INSTANCE_TYPE_OPTIONS.map((option) => option.value)).toContain(
      DEFAULT_AWS_INSTANCE_TYPE,
    );
    expect(AWS_ROOT_VOLUME_SIZE_OPTIONS.map((option) => option.value)).toContain(
      DEFAULT_ROOT_VOLUME_SIZE_GB,
    );
    expect(AWS_DATA_VOLUME_SIZE_OPTIONS.map((option) => option.value)).toContain(
      DEFAULT_DATA_VOLUME_SIZE_GB,
    );
  });

  it('preserves an existing custom value as a selectable current option', () => {
    expect(optionsWithCurrent(AWS_REGION_OPTIONS, 'ap-southeast-2')[0]).toEqual({
      value: 'ap-southeast-2',
      label: 'ap-southeast-2',
      hint: 'Current value from .company-brain.aws.json.',
    });
  });
});
