export class UploadRequestError extends Error {
  readonly status: number | null
  readonly serverMessage: string | null
  readonly retryAfter: number | null

  constructor(status: number | null, serverMessage: string | null, retryAfter: number | null) {
    super('Upload request failed')
    this.name = 'UploadRequestError'
    this.status = status
    this.serverMessage = serverMessage
    this.retryAfter = retryAfter
  }
}
