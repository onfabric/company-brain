import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const companyBrainHome =
  process.env.COMPANY_BRAIN_HOME || join(defaultApplicationSupportDir(), 'company-brain');
export const runtimePath =
  process.env.COMPANY_BRAIN_RUNTIME_DIR || join(companyBrainHome, 'runtime');
export const nangoIntegrationsPath =
  process.env.COMPANY_BRAIN_INTEGRATIONS_DIR || join(companyBrainHome, 'nango-integrations');
export const cloudConfigDir = join(companyBrainHome, 'cloud');
export const downloadsPath = join(companyBrainHome, 'downloads');
export const releaseStatePath = join(companyBrainHome, 'release.json');

export const awsConfigPath = join(cloudConfigDir, 'config.json');
export const terraformPath = join(runtimePath, 'infra/terraform');
export const deployPath = join(runtimePath, 'infra/deploy');

function defaultApplicationSupportDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library/Application Support');
  }

  return process.env.XDG_DATA_HOME || join(homedir(), '.local/share');
}
