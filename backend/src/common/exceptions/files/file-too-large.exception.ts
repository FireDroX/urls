export class FileTooLargeException extends Error {
  constructor() {
    super('File exceeds the maximum size');
    this.name = 'FileTooLargeException';
  }
}
