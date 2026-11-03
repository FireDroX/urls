export class ShareNotFoundException extends Error {
  constructor() {
    super('Share not found');
    this.name = 'ShareNotFoundException';
  }
}
