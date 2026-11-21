export class DropExpiredException extends Error {
  constructor() {
    super('Drop expired');
    this.name = 'DropExpiredException';
  }
}
