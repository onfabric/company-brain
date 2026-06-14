import { type AwsConfig, hostedNangoEnvDefaults } from './aws-config.ts';
import {
  applyNangoEnvOverrides,
  type NangoEnvOverrides,
  type NangoEnvValues,
  processNangoEnv,
} from './nango-env.ts';

export function hostedExistingNangoEnv(
  config: AwsConfig | undefined,
  overrides: NangoEnvOverrides,
): NangoEnvValues {
  const existing = config ? hostedNangoEnvDefaults(config) : processNangoEnv();

  return applyNangoEnvOverrides(existing, overrides);
}
