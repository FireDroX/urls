import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApiClient } from './public-api-client'

afterEach(() => vi.restoreAllMocks())

describe('publicApiClient', () => {
  it('rejects a 401 without ever calling the refresh endpoint', async () => {
    const post = vi.spyOn(axios, 'post')
    const requested: (string | undefined)[] = []
    const adapter: AxiosAdapter = (config) => {
      requested.push(config.url)
      const response = { status: 401, data: {}, headers: {}, statusText: '', config } as AxiosResponse
      return Promise.reject(new AxiosError('unauthorized', undefined, config, undefined, response))
    }

    await expect(publicApiClient.get('/public/drops/abc', { adapter })).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(requested).toEqual(['/public/drops/abc'])
    expect(post).not.toHaveBeenCalled()
  })

  it('sends no credentials', () => {
    expect(publicApiClient.defaults.withCredentials).toBeUndefined()
  })
})
