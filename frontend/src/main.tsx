import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { getSettings } from '#api/settings'
import { AuthProvider } from '#components/AuthProvider'
import { Toaster } from '#components/ui/sonner'
import i18n, { applyLocale } from '#lib/i18n'
import './index.css'

async function bootstrap() {
  await getSettings()
    .then((settings) => applyLocale(settings.locale))
    .catch(() => undefined)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" scriptProps={{ type: 'application/json' }}>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster />
            </AuthProvider>
          </BrowserRouter>
        </I18nextProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

void bootstrap()
