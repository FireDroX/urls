export class FileNotFoundException extends Error {
  constructor() {
    super('File not found');
    this.name = 'FileNotFoundException';
  }
}
