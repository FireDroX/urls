export class FileInUseException extends Error {
  constructor() {
    super('File is still attached to a share');
    this.name = 'FileInUseException';
  }
}
