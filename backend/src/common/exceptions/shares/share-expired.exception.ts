export class ShareExpiredException extends Error {
  constructor() {
    super('Share expired');
    this.name = 'ShareExpiredException';
  }
}
