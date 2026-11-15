import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listTags, type Tag } from '#api/tags'
import { useTags } from './useTags'

vi.mock('#api/tags', () => ({ listTags: vi.fn() }))

const tag = (id: string, name: string): Tag => ({ id, name, color: '#000000', linkCount: 0 }) as Tag

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useTags', () => {
  it('adds a new tag at its alphabetical position', async () => {
    vi.mocked(listTags).mockResolvedValue([tag('a', 'alpha'), tag('c', 'charlie')])
    const { result } = renderHook(() => useTags())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    act(() => result.current.add(tag('b', 'bravo')))

    expect(result.current.state).toMatchObject({ tags: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] })
  })
})
