import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import i18n from '#lib/i18n'
import { linkOrganizationErrorMessage, linkOrganizationNotFound } from './link-organization-errors'

function httpError(status: number, error: string): AxiosError {
  const response = { status, data: { error }, headers: {}, statusText: '', config: {} } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

describe('linkOrganizationNotFound', () => {
  it('recognizes a missing tag and a missing folder', () => {
    expect(linkOrganizationNotFound(httpError(404, 'Tag not found'))).toBe('tag')
    expect(linkOrganizationNotFound(httpError(404, 'Folder not found'))).toBe('folder')
  })

  it('ignores other errors', () => {
    expect(linkOrganizationNotFound(httpError(404, 'Link not found'))).toBeNull()
    expect(linkOrganizationNotFound(httpError(409, 'Tag not found'))).toBeNull()
    expect(linkOrganizationNotFound(new Error('boom'))).toBeNull()
  })
})

describe('linkOrganizationErrorMessage', () => {
  const t = i18n.t.bind(i18n)

  it('translates the missing tag and folder', () => {
    expect(linkOrganizationErrorMessage(httpError(404, 'Tag not found'), t)).toBe(t('linkOrganization.errors.tagNotFound'))
    expect(linkOrganizationErrorMessage(httpError(404, 'Folder not found'), t)).toBe(
      t('linkOrganization.errors.folderNotFound'),
    )
    expect(linkOrganizationErrorMessage(httpError(500, 'x'), t)).toBeNull()
  })
})
