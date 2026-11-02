export class SlugAlreadyTakenException extends Error {
  constructor() {
    super('Slug already taken');
    this.name = 'SlugAlreadyTakenException';
  }
}
