export class AgentSyncStore {
  constructor(private readonly dataDir: string) {}

  dataDirectory(): string {
    return this.dataDir;
  }
}
