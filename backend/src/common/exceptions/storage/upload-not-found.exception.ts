export class UploadNotFoundException extends Error {
  constructor() {
    super('Multipart upload not found');
    this.name = 'UploadNotFoundException';
  }
}
