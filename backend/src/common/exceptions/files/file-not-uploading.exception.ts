export class FileNotUploadingException extends Error {
  constructor() {
    super('File is no longer being uploaded');
    this.name = 'FileNotUploadingException';
  }
}
