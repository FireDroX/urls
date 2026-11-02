export class LinkExpiredException extends Error {
  constructor() {
    super('Link expired');
    this.name = 'LinkExpiredException';
  }
}
