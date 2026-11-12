import { UploadCanceledError } from '#lib/share-errors'

interface TurnstileGateOptions {
  required: boolean
  onConsumed: () => void
}

export class TurnstileGate {
  private token: string | null = null
  private waiter: ((token: string) => void) | null = null
  private readonly options: TurnstileGateOptions

  constructor(options: TurnstileGateOptions) {
    this.options = options
  }

  provide(token: string): void {
    if (this.waiter) {
      const resolve = this.waiter
      this.waiter = null
      this.options.onConsumed()
      resolve(token)
      return
    }
    this.token = token
  }

  expire(): void {
    this.token = null
  }

  next(signal: AbortSignal): Promise<string> {
    if (!this.options.required) {
      return Promise.resolve('')
    }
    if (signal.aborted) {
      return Promise.reject(new UploadCanceledError())
    }
    if (this.token !== null) {
      const token = this.token
      this.token = null
      this.options.onConsumed()
      return Promise.resolve(token)
    }
    return new Promise((resolve, reject) => {
      this.waiter = resolve
      signal.addEventListener(
        'abort',
        () => {
          if (this.waiter === resolve) this.waiter = null
          reject(new UploadCanceledError())
        },
        { once: true },
      )
    })
  }
}
