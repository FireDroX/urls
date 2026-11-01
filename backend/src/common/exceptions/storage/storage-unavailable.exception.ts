export class StorageUnavailableException extends Error {
  constructor() {
    super('Object storage is unavailable');
    this.name = 'StorageUnavailableException';
  }
}
