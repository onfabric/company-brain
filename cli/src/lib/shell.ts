export type RunOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  verbose?: boolean;
  capture?: boolean;
};

export async function run(cmd: string[], options: RunOptions = {}): Promise<string> {
  if (options.verbose) {
    console.log(`$ ${cmd.join(' ')}`);
  }

  const child = Bun.spawn({
    cmd,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: 'inherit',
    stdout: options.capture ? 'pipe' : 'inherit',
    stderr: options.capture ? 'pipe' : 'inherit',
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.capture ? new Response(child.stdout).text() : Promise.resolve(''),
    options.capture ? new Response(child.stderr).text() : Promise.resolve(''),
  ]);

  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim();
    throw new Error(
      [`Command failed with exit ${exitCode}: ${cmd.join(' ')}`, detail].filter(Boolean).join('\n'),
    );
  }

  return stdout;
}

export async function commandSucceeds(cmd: string[], options: RunOptions = {}): Promise<boolean> {
  const child = Bun.spawn({
    cmd,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  });

  return (await child.exited) === 0;
}
