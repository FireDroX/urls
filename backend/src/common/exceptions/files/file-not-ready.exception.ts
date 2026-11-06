export class FileNotReadyException extends Error {
  constructor() {
    super('File is not ready');
    this.name = 'FileNotReadyException';
  }
}
