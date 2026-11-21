export class DropNotFoundException extends Error {
  constructor() {
    super('Drop not found');
    this.name = 'DropNotFoundException';
  }
}
