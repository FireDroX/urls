import { useMemo, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { changePassword } from '#api/auth'
import { updateSetting } from '#api/settings'
import { FormError } from '#components/FormError'
import { Button } from '#components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { extractErrorMessage } from '#lib/api-errors'
import { applyLocale, SUPPORTED_LOCALES } from '#lib/i18n'
import { createChangePasswordSchema, type ChangePasswordFormValues } from '#schemas/auth.schema'

const LOCALE_LABEL_KEYS = { fr: 'settings.languageFr', en: 'settings.languageEn' } as const

const PASSWORD_FIELDS = [
  { name: 'currentPassword', labelKey: 'settings.currentPassword', autoComplete: 'current-password' },
  { name: 'newPassword', labelKey: 'settings.newPassword', autoComplete: 'new-password' },
  { name: 'confirmPassword', labelKey: 'settings.confirmPassword', autoComplete: 'new-password' },
] as const

function SettingsCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function LanguageSetting() {
  const { t, i18n } = useTranslation()
  const [pending, setPending] = useState(false)

  async function handleChange(value: string) {
    setPending(true)
    try {
      const settings = await updateSetting('locale', value)
      await applyLocale(settings.locale)
      toast.success(i18n.t('settings.languageUpdated'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('settings.languageUpdateFailed')))
    } finally {
      setPending(false)
    }
  }

  return (
    <SettingsCard title={t('settings.languageTitle')} description={t('settings.languageHelp')}>
      <Field>
        <FieldLabel htmlFor="settings-locale">{t('settings.languageLabel')}</FieldLabel>
        <Select value={i18n.language} onValueChange={handleChange} disabled={pending}>
          <SelectTrigger id="settings-locale" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {t(LOCALE_LABEL_KEYS[locale])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </SettingsCard>
  )
}

function PasswordSetting() {
  const { t } = useTranslation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createChangePasswordSchema(t), [t])
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function onSubmit(values: ChangePasswordFormValues) {
    setSubmitError(null)
    try {
      await changePassword(values.currentPassword, values.newPassword)
      reset()
      toast.success(t('settings.passwordChanged'))
    } catch (error) {
      setSubmitError(extractErrorMessage(error))
    }
  }

  return (
    <SettingsCard title={t('settings.passwordTitle')} description={t('settings.passwordHelp')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          {PASSWORD_FIELDS.map(({ name, labelKey, autoComplete }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field, fieldState }) => (
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor={`settings-${name}`}>{t(labelKey)}</FieldLabel>
                  <Input {...field} id={`settings-${name}`} type="password" autoComplete={autoComplete} />
                  {name === 'newPassword' && !fieldState.error && (
                    <FieldDescription>{t('settings.passwordRules')}</FieldDescription>
                  )}
                  {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                </Field>
              )}
            />
          ))}
          <FormError message={submitError} />
          <Button type="submit" disabled={isSubmitting} className="w-fit">
            {t('settings.changePassword')}
          </Button>
        </FieldGroup>
      </form>
    </SettingsCard>
  )
}

export function Settings() {
  const { t } = useTranslation()
  useDocumentTitle(t('settings.title'))

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl font-bold">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>
      <LanguageSetting />
      <PasswordSetting />
    </>
  )
}
