export function isNonInteractive(requested = false): boolean {
  return requested || process.env.CI === 'true';
}
