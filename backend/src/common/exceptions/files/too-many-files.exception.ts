export class TooManyFilesException extends Error {
  constructor() {
    super('Share has reached its maximum number of files');
    this.name = 'TooManyFilesException';
  }
}
