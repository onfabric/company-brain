import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isCancel, select } from '@clack/prompts';
import { z } from 'zod';
import { type Target, TargetSchema, targetLabel, targets } from './deployment-target.ts';
import { cliConfigPath } from './paths.ts';

const CLI_CONFIG_VERSION = 1;

const CliConfigSchema = z.object({
  version: z.literal(CLI_CONFIG_VERSION).default(CLI_CONFIG_VERSION),
  target: TargetSchema.optional(),
});

type CliConfig = z.infer<typeof CliConfigSchema>;

export const targetOptions = {
  target: {
    schema: TargetSchema.optional(),
    description: 'Use local or cloud for this run without changing the saved target.',
  },
} as const;

export async function readSelectedTarget(): Promise<Target | undefined> {
  return (await readCliConfig()).target;
}

export async function writeSelectedTarget(target: Target): Promise<void> {
  await writeCliConfig({ version: CLI_CONFIG_VERSION, target });
}

export async function resolveCommandTarget(
  override: Target | undefined,
  nonInteractive: boolean,
): Promise<Target> {
  if (override) {
    return override;
  }

  const selected = await readSelectedTarget();
  if (selected) {
    return selected;
  }

  if (nonInteractive) {
    throw new Error(
      'No Company Brain target selected. Run `company-brain target local|cloud`, or pass `--target local|cloud`.',
    );
  }

  return await promptAndSaveTarget();
}

export async function promptAndSaveTarget(): Promise<Target> {
  const current = await readSelectedTarget();
  const answer = await select({
    message: 'Select Company Brain target',
    options: targets.map((target) => ({
      value: target,
      label: current === target ? `${targetLabel(target)} (current)` : targetLabel(target),
    })),
  });

  if (isCancel(answer)) {
    throw new Error('Target selection cancelled.');
  }

  await writeSelectedTarget(answer);
  return answer;
}

async function readCliConfig(): Promise<CliConfig> {
  if (!existsSync(cliConfigPath)) {
    return { version: CLI_CONFIG_VERSION };
  }

  const raw = JSON.parse(await readFile(cliConfigPath, 'utf8')) as unknown;
  return CliConfigSchema.parse(raw);
}

async function writeCliConfig(config: CliConfig): Promise<void> {
  await mkdir(dirname(cliConfigPath), { recursive: true });
  await writeFile(cliConfigPath, `${JSON.stringify(CliConfigSchema.parse(config), null, 2)}\n`);
}

export function rejectOptionsForTarget(
  target: Target,
  options: Record<string, unknown>,
  optionTargets: Record<string, Target>,
): void {
  for (const [option, expectedTarget] of Object.entries(optionTargets)) {
    if (target === expectedTarget || options[option] === undefined) {
      continue;
    }

    throw new Error(`--${option} is only available with --target ${expectedTarget}.`);
  }
}
