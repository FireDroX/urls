import { act, renderHook } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDropFile } from '#api/public-drops'
import { FILE_STATUS_POLL_MS } from '#hooks/useShareDetail'
import { useDropReceipts } from './useDropReceipts'

vi.mock('#api/public-drops', () => ({ getDropFile: vi.fn() }))

const uploaded = { shareId: 'drop1', fileId: 'file1', name: 'a.txt', size: 3 }

function httpFailure(status: number): AxiosError {
  return new AxiosError('failed', undefined, undefined, undefined, { status, data: {} } as AxiosResponse)
}

async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(FILE_STATUS_POLL_MS)
  })
}

function setup() {
  const hook = renderHook(() => useDropReceipts('drop1'))
  act(() => hook.result.current.add(uploaded))
  return hook
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDropReceipts', () => {
  it('marks a receipt unavailable on a 404 and stops polling', async () => {
    vi.mocked(getDropFile).mockRejectedValue(httpFailure(404))
    const { result } = setup()

    await tick()
    expect(result.current.receipts[0].status).toBe('unavailable')
    await tick()

    expect(getDropFile).toHaveBeenCalledOnce()
  })

  it.each([
    ['network', new AxiosError('Network Error')],
    ['5xx', httpFailure(500)],
    ['429', httpFailure(429)],
  ])('keeps the receipt verifying and polls again after a %s error', async (_label, failure) => {
    vi.mocked(getDropFile).mockRejectedValue(failure)
    const { result } = setup()

    await tick()
    await tick()

    expect(result.current.receipts[0].status).toBe('verifying')
    expect(getDropFile).toHaveBeenCalledTimes(2)
  })

  it('stops polling once the file is ready', async () => {
    vi.mocked(getDropFile).mockResolvedValue({ status: 'ready' } as Awaited<ReturnType<typeof getDropFile>>)
    const { result } = setup()

    await tick()
    await tick()

    expect(result.current.receipts[0].status).toBe('ready')
    expect(getDropFile).toHaveBeenCalledOnce()
  })
})
