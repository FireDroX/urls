export class TagNameAlreadyTakenException extends Error {
  constructor() {
    super('Tag name already taken');
    this.name = 'TagNameAlreadyTakenException';
  }
}
