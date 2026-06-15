export type NangoEnvValues = Record<string, string>;

export type NangoEnvOverrides = {
  nangoHostport?: string;
  nangoSecretKey?: string;
};

export function processNangoEnv(overrides: NangoEnvOverrides = {}): NangoEnvValues {
  const values: NangoEnvValues = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value) {
      values[key] = value;
    }
  }

  return applyNangoEnvOverrides(values, overrides);
}

export function applyNangoEnvOverrides(
  values: NangoEnvValues,
  overrides: NangoEnvOverrides = {},
): NangoEnvValues {
  return {
    ...values,
    ...(overrides.nangoHostport
      ? { NANGO_HOSTPORT: normalizeNangoHostport(overrides.nangoHostport) }
      : {}),
    ...(overrides.nangoSecretKey ? { NANGO_SECRET_KEY_DEV: overrides.nangoSecretKey } : {}),
  };
}

export function normalizeNangoHostport(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
