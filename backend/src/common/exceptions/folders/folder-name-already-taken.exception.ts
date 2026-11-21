export class FolderNameAlreadyTakenException extends Error {
  constructor() {
    super('Folder name already taken');
    this.name = 'FolderNameAlreadyTakenException';
  }
}
