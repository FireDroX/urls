export class TagPublicIdTakenException extends Error {
  constructor() {
    super('Tag public id already taken');
    this.name = 'TagPublicIdTakenException';
  }
}
