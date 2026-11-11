import { describe, expect, it, vi } from 'vitest'
import { UploadCanceledError } from '#lib/share-errors'
import { TurnstileGate } from './turnstile-gate'

function setup(required = true) {
  const onConsumed = vi.fn()
  return { gate: new TurnstileGate({ required, onConsumed }), onConsumed }
}

const signal = () => new AbortController().signal

describe('TurnstileGate', () => {
  it('hands a stored token out once', async () => {
    const { gate, onConsumed } = setup()
    gate.provide('a')

    await expect(gate.next(signal())).resolves.toBe('a')
    expect(onConsumed).toHaveBeenCalledOnce()

    const second = vi.fn()
    void gate.next(signal()).then(second)
    await Promise.resolve()
    expect(second).not.toHaveBeenCalled()
  })

  it('waits until a token is provided', async () => {
    const { gate, onConsumed } = setup()
    const pending = gate.next(signal())

    gate.provide('late')

    await expect(pending).resolves.toBe('late')
    expect(onConsumed).toHaveBeenCalledOnce()
  })

  it('never uses an expired token', async () => {
    const { gate } = setup()
    gate.provide('old')
    gate.expire()
    const pending = gate.next(signal())
    gate.provide('new')

    await expect(pending).resolves.toBe('new')
  })

  it('gives one distinct token per call', async () => {
    const { gate } = setup()
    gate.provide('one')
    const first = await gate.next(signal())
    const second = gate.next(signal())
    gate.provide('two')

    expect([first, await second]).toEqual(['one', 'two'])
  })

  it('rejects when aborted while waiting, and keeps later tokens', async () => {
    const { gate } = setup()
    const controller = new AbortController()
    const pending = gate.next(controller.signal)

    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(UploadCanceledError)
    gate.provide('kept')
    await expect(gate.next(signal())).resolves.toBe('kept')
  })

  it('rejects an already aborted signal', async () => {
    const { gate } = setup()
    const controller = new AbortController()
    controller.abort()

    await expect(gate.next(controller.signal)).rejects.toBeInstanceOf(UploadCanceledError)
  })

  it('resolves an empty token at once when no token is required', async () => {
    const { gate, onConsumed } = setup(false)

    await expect(gate.next(signal())).resolves.toBe('')
    expect(onConsumed).not.toHaveBeenCalled()
  })
})
