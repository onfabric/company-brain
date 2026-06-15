import { z } from 'zod';

export const targets = ['local', 'cloud'] as const;
export const TargetSchema = z.enum(targets);
export type Target = z.infer<typeof TargetSchema>;

export function isTarget(value: unknown): value is Target {
  return TargetSchema.safeParse(value).success;
}

export function targetLabel(target: Target): string {
  return target;
}
