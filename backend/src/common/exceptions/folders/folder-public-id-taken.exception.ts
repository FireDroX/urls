export class FolderPublicIdTakenException extends Error {
  constructor() {
    super('Folder public id already taken');
    this.name = 'FolderPublicIdTakenException';
  }
}
