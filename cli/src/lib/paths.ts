import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const companyBrainHome =
  process.env.COMPANY_BRAIN_HOME || join(defaultApplicationSupportDir(), 'company-brain');
export const runtimePath =
  process.env.COMPANY_BRAIN_RUNTIME_DIR || join(companyBrainHome, 'runtime');
export const nangoIntegrationsPath =
  process.env.COMPANY_BRAIN_INTEGRATIONS_DIR || join(companyBrainHome, 'nango-integrations');
export const localTargetPath = join(companyBrainHome, 'local');
export const cloudTargetPath = join(companyBrainHome, 'cloud');
export const downloadsPath = join(companyBrainHome, 'downloads');
export const releaseStatePath = join(companyBrainHome, 'release.json');

export const rootEnvPath = join(localTargetPath, '.env');
export const rootEnvExamplePath = join(runtimePath, '.env.example');
export const nangoEnvPath = join(localTargetPath, 'nango-integrations.env');
export const nangoEnvExamplePath = join(nangoIntegrationsPath, '.env.example');
export const localConfigPath = join(localTargetPath, 'config.json');
export const awsConfigPath = join(cloudTargetPath, 'config.json');
export const cliConfigPath = join(companyBrainHome, 'config.json');
export const terraformPath = join(runtimePath, 'infra/terraform');
export const deployPath = join(runtimePath, 'infra/deploy');

function defaultApplicationSupportDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library/Application Support');
  }

  return process.env.XDG_DATA_HOME || join(homedir(), '.local/share');
}
