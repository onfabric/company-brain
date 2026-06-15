import { join } from 'node:path';

export const repoRoot = join(import.meta.dir, '../../..');
export const rootEnvPath = join(repoRoot, '.env');
export const rootEnvExamplePath = join(repoRoot, '.env.example');
export const nangoIntegrationsPath = join(repoRoot, 'nango-integrations');
export const nangoEnvPath = join(nangoIntegrationsPath, '.env');
export const nangoEnvExamplePath = join(nangoIntegrationsPath, '.env.example');
export const localConfigPath = join(repoRoot, '.company-brain.local.json');
export const awsConfigPath = join(repoRoot, '.company-brain.aws.json');
export const cliConfigPath = join(repoRoot, '.company-brain.cli.json');
export const terraformPath = join(repoRoot, 'infra/terraform');
export const deployPath = join(repoRoot, 'infra/deploy');
export const nangoSubmodulePath = join(repoRoot, 'nango');
