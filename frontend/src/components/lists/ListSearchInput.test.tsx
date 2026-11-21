import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIST_SEARCH_DEBOUNCE_MS } from '#api/list-params'
import { ListSearchInput } from './ListSearchInput'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ListSearchInput', () => {
  it('reports the last trimmed value once the debounce delay has passed', () => {
    const onChange = vi.fn()
    render(<ListSearchInput value="" placeholder="Search" onChange={onChange} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'do' } })
    act(() => vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS - 1))
    fireEvent.change(input, { target: { value: ' docs ' } })
    act(() => vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS - 1))
    expect(onChange).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('docs')
  })

  it('does not report a value equal to the current one', () => {
    const onChange = vi.fn()
    render(<ListSearchInput value="docs" placeholder="Search" onChange={onChange} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'docs ' } })
    act(() => vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('follows a value changed from outside', () => {
    const { rerender } = render(<ListSearchInput value="docs" placeholder="Search" onChange={vi.fn()} />)

    rerender(<ListSearchInput value="" placeholder="Search" onChange={vi.fn()} />)

    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('drops a pending report on unmount', () => {
    const onChange = vi.fn()
    const { unmount } = render(<ListSearchInput value="" placeholder="Search" onChange={onChange} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } })
    unmount()
    act(() => vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS))

    expect(onChange).not.toHaveBeenCalled()
  })
})
