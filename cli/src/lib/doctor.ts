import { styleText } from 'node:util';
import { log, note } from '@clack/prompts';

export type DoctorCheck = {
  ok: boolean;
  label: string;
  detail?: string;
};

export function renderDoctorSection(title: string, checks: DoctorCheck[]): void {
  log.info(styleText('blue', title), { spacing: 0 });
  for (const check of checks) {
    log.message(formatDoctorCheck(check), {
      symbol: check.ok ? styleText('green', '◆') : styleText('yellow', '▲'),
      spacing: 0,
    });
  }
}

export function renderDoctorChecks(checks: DoctorCheck[]): void {
  for (const check of checks) {
    const icon = check.ok ? styleText('green', '◆') : styleText('yellow', '▲');
    console.log(`${icon} ${check.ok ? 'Ready' : 'Needs attention'}: ${check.label}`);
    if (check.detail) {
      note(check.detail, check.label);
    }
  }
}

export function formatAttentionOutro(failed: DoctorCheck[]): string {
  const label = failed.length === 1 ? 'item needs' : 'items need';
  return `${failed.length} ${label} attention. The next step is shown beside each one.`;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDoctorCheck(check: DoctorCheck): string {
  const color = check.ok ? 'green' : 'yellow';
  const lines = [`${check.ok ? 'Ready' : 'Needs attention'}: ${check.label}`];

  if (check.detail) {
    lines.push(...check.detail.split('\n').map((line) => `   ${line}`));
  }

  return lines.map((line) => styleText(color, line)).join('\n');
}
