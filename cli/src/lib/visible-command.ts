import { confirm, isCancel } from '@clack/prompts';
import { repoRoot } from './paths.ts';

export type VisibleCommandContext = {
  yes?: boolean;
  nonInteractive?: boolean;
};

export type VisibleCommandOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  capture?: boolean;
  input?: string;
  approve?: boolean;
  redactions?: string[];
  purpose?: string;
};

export async function runVisible(
  cmd: string[],
  context: VisibleCommandContext,
  options: VisibleCommandOptions = {},
): Promise<string> {
  showCommand(cmd, options);
  await approveCommand(cmd, context, options);

  const child = Bun.spawn({
    cmd,
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    stdin: options.input === undefined ? 'inherit' : 'pipe',
    stdout: options.capture ? 'pipe' : 'inherit',
    stderr: options.capture ? 'pipe' : 'inherit',
  });

  if (options.input !== undefined) {
    child.stdin?.write(options.input);
    child.stdin?.end();
  }

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.capture ? new Response(child.stdout).text() : Promise.resolve(''),
    options.capture ? new Response(child.stderr).text() : Promise.resolve(''),
  ]);

  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim();
    throw new Error(
      [`Command failed with exit ${exitCode}: ${renderCommand(cmd, options.redactions)}`, detail]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return stdout;
}

export function renderCommand(cmd: string[], redactions: string[] = []): string {
  const rendered = cmd.map(quoteArg).join(' ');
  return redactions
    .filter((value) => value.length > 0)
    .reduce((output, secret) => output.split(secret).join('[redacted]'), rendered);
}

function showCommand(cmd: string[], options: VisibleCommandOptions): void {
  if (options.purpose) {
    console.log(options.purpose);
  }
  console.log(`$ ${renderCommand(cmd, options.redactions)}`);
}

async function approveCommand(
  cmd: string[],
  context: VisibleCommandContext,
  options: VisibleCommandOptions,
): Promise<void> {
  if (!options.approve || context.yes) {
    return;
  }

  if (context.nonInteractive) {
    throw new Error(`Refusing to run without approval: ${renderCommand(cmd, options.redactions)}`);
  }

  const answer = await confirm({
    message: 'Run this command?',
    initialValue: true,
  });

  if (isCancel(answer) || !answer) {
    throw new Error('Command cancelled.');
  }
}

function quoteArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(arg)) {
    return arg;
  }

  return `'${arg.replaceAll("'", "'\"'\"'")}'`;
}
