export class FolderNotFoundException extends Error {
  constructor() {
    super('Folder not found');
    this.name = 'FolderNotFoundException';
  }
}
