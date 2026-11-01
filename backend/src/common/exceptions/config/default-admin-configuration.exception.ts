export class DefaultAdminConfigurationException extends Error {
  constructor(readonly problems: string[]) {
    super(
      [
        'No account exists yet and the admin account cannot be created:',
        ...problems.map((problem) => `  - ${problem}`),
      ].join('\n'),
    );
    this.name = 'DefaultAdminConfigurationException';
  }
}
