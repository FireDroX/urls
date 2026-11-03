export class StorageQuotaExceededException extends Error {
  constructor() {
    super('Storage quota exceeded');
    this.name = 'StorageQuotaExceededException';
  }
}
