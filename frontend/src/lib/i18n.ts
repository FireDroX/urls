import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '#locales/en.json'
import fr from '#locales/fr.json'

export const SUPPORTED_LOCALES = ['fr', 'en'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
const DEFAULT_LOCALE: Locale = 'fr'

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

void i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
})

i18next.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

export async function applyLocale(locale: string): Promise<void> {
  if (isLocale(locale) && i18next.language !== locale) {
    await i18next.changeLanguage(locale)
  }
}

export default i18next
