export class UploadIncompleteException extends Error {
  constructor() {
    super('Upload is missing parts or has parts of the wrong size');
    this.name = 'UploadIncompleteException';
  }
}
