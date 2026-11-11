export class LinkBytesLimitExceededException extends Error {
  constructor() {
    super('Upload exceeds the link size limit');
    this.name = 'LinkBytesLimitExceededException';
  }
}
