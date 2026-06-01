import fs from 'node:fs';
import path from 'node:path';

import type { HookEventEnvelope } from './types.js';
import { safeSegment } from './utils.js';

export class AgentCaptureStore {
  constructor(private readonly dataDir: string) {}

  dataDirectory(): string {
    return this.dataDir;
  }

  async appendEvent(envelope: HookEventEnvelope): Promise<void> {
    const filePath = path.join(this.dataDir, 'events', `${safeSegment(envelope.source)}.jsonl`);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.appendFile(filePath, `${JSON.stringify(envelope)}\n`);
  }
}
