export class PartTooLargeException extends Error {
  constructor() {
    super('Part exceeds its expected size');
    this.name = 'PartTooLargeException';
  }
}
