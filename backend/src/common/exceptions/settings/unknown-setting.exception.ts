export class UnknownSettingException extends Error {
  constructor() {
    super('Unknown setting');
    this.name = 'UnknownSettingException';
  }
}
