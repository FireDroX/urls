export class WeakPasswordException extends Error {
  constructor() {
    super(
      'Password must be at least 12 characters with an uppercase letter, a lowercase letter, a digit and a symbol',
    );
    this.name = 'WeakPasswordException';
  }
}
