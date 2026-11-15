import { describe, expect, it } from 'vitest'
import i18next from '#lib/i18n'

describe('delete descriptions', () => {
  it('use the zero form in French for an unused tag or folder', async () => {
    await i18next.changeLanguage('fr')
    expect(i18next.t('organization.tags.delete.description', { name: 'x', count: 0 })).toBe(
      'Le tag « x » n\'est utilisé par aucun lien.',
    )
    expect(i18next.t('organization.folders.delete.description', { name: 'x', count: 0 })).toBe(
      'Le dossier « x » ne contient aucun lien.',
    )
    expect(i18next.t('organization.tags.delete.description', { name: 'x', count: 1 })).toContain('de son lien')
  })
})
