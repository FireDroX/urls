import { describe, expect, it } from 'vitest'
import { sameOriginPath } from './safe-redirect'

const ORIGIN = 'https://url.example.org'

describe('sameOriginPath', () => {
  it.each([
    ['/links?type=r#top', '/links?type=r#top'],
    ['https://url.example.org/account', '/account'],
  ])('keeps the same-origin path %s', (raw, expected) => {
    expect(sameOriginPath(raw, ORIGIN)).toBe(expected)
  })

  it.each([
    'https://evil.example.com/',
    '//evil.example.com/path',
    '/\\evil.example.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ])('rejects %s', (raw) => {
    expect(sameOriginPath(raw, ORIGIN)).toBeNull()
  })

  it('returns null without a value', () => {
    expect(sameOriginPath(null, ORIGIN)).toBeNull()
  })
})
