export class InitMissingConfigError extends Error {
  constructor() {
    super('agent-sync setup incomplete');
  }
}
