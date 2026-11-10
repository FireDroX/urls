export class DropLimitExceededException extends Error {
  constructor() {
    super('Upload exceeds the drop limits');
    this.name = 'DropLimitExceededException';
  }
}
