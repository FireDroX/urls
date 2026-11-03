export class PartLengthMismatchException extends Error {
  constructor() {
    super('Part body does not match its expected size');
    this.name = 'PartLengthMismatchException';
  }
}
