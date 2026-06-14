import type { AwsConfig } from './aws-config.ts';
import { normalizeAwsEnvironment } from './aws-environment.ts';

export type AwsHostnames = Pick<
  AwsConfig,
  'nangoHostname' | 'nangoConnectHostname' | 'brainHostname' | 'dozzleHostname'
>;

export function deriveAwsHostnames(environment: string, baseDomain: string): AwsHostnames {
  const suffix = stripDomain(baseDomain);
  const env = normalizeAwsEnvironment(environment);

  return {
    nangoHostname: `nango-${env}.${suffix}`,
    nangoConnectHostname: `nango-auth-${env}.${suffix}`,
    brainHostname: `brain-${env}.${suffix}`,
    dozzleHostname: `dozzle-${env}.${suffix}`,
  };
}

export function inferBaseDomain(existing: AwsConfig | undefined): string | undefined {
  if (!existing) {
    return undefined;
  }

  const derivedSuffixes = [
    hostnameSuffix(existing.nangoHostname, `nango-${existing.environment}`),
    hostnameSuffix(existing.nangoConnectHostname, `nango-auth-${existing.environment}`),
    hostnameSuffix(existing.brainHostname, `brain-${existing.environment}`),
    hostnameSuffix(existing.dozzleHostname, `dozzle-${existing.environment}`),
  ];
  const [first] = derivedSuffixes;

  return first && derivedSuffixes.every((suffix) => suffix === first) ? first : undefined;
}

export function pickAwsHostnames(config: AwsConfig): AwsHostnames {
  return {
    nangoHostname: config.nangoHostname,
    nangoConnectHostname: config.nangoConnectHostname,
    brainHostname: config.brainHostname,
    dozzleHostname: config.dozzleHostname,
  };
}

export function sameAwsHostnames(left: AwsHostnames, right: AwsHostnames): boolean {
  return (
    left.nangoHostname === right.nangoHostname &&
    left.nangoConnectHostname === right.nangoConnectHostname &&
    left.brainHostname === right.brainHostname &&
    left.dozzleHostname === right.dozzleHostname
  );
}

function stripDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/^\.+/, '');
}

function hostnameSuffix(hostname: string, prefix: string): string | undefined {
  const expectedPrefix = `${prefix}.`;
  return hostname.startsWith(expectedPrefix) ? hostname.slice(expectedPrefix.length) : undefined;
}
