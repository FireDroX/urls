export class FileIdTakenException extends Error {
  constructor() {
    super('File public id already taken');
    this.name = 'FileIdTakenException';
  }
}
