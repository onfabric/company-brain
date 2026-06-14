export function firstPositionalArg(args = Bun.argv.slice(2)): string | undefined {
  return args.find((arg) => !arg.startsWith('--'));
}

export function flagValue(name: string, args = Bun.argv.slice(2)): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const next = args[index + 1];
  return next && !next.startsWith('--') ? next : undefined;
}

export function hasFlag(name: string, args = Bun.argv.slice(2)): boolean {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
}

export function optionalEnv(key: string): string | undefined {
  const value = Bun.env[key]?.trim();
  return value ? value : undefined;
}

export function requiredEnv(...keys: string[]): string {
  const value = keys.map(optionalEnv).find((candidate) => candidate);
  if (!value) {
    throw new Error(`Missing required environment variable: ${keys.join(' or ')}`);
  }

  return value;
}
