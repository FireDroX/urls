export class InvalidTurnstileTokenException extends Error {
  constructor() {
    super('Captcha verification failed');
    this.name = 'InvalidTurnstileTokenException';
  }
}
