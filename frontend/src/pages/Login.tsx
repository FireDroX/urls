import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormError } from '#components/FormError'
import { Mascot } from '#components/Logo'
import { TurnstileWidget } from '#components/Turnstile'
import { Button } from '#components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { useAuth } from '#hooks/useAuth'
import { useCountdown } from '#hooks/useCountdown'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { extractErrorMessage, retryAfterSeconds } from '#lib/api-errors'
import { createLoginSchema, type LoginFormValues } from '#schemas/auth.schema'
import { sameOriginPath } from '#utils/safe-redirect'

const UNAUTHORIZED = 401
const ACCOUNT_LOCKED = 423

function LoginForm({ redirectTo }: { redirectTo: string }) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const lockout = useCountdown()
  const schema = useMemo(() => createLoginSchema(t), [t])

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginFormValues) {
    if (turnstileToken === null) return
    setSubmitError(null)
    try {
      await login({ ...values, turnstileToken: turnstileToken || undefined })
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setTurnstileResetKey((key) => key + 1)
      const status = isAxiosError(error) ? error.response?.status : undefined
      if (status === ACCOUNT_LOCKED) {
        const seconds = retryAfterSeconds(error)
        lockout.start(seconds)
        setSubmitError(seconds === null ? t('auth.accountLockedNoDelay') : null)
        return
      }
      setSubmitError(status === UNAUTHORIZED ? t('auth.invalidCredentials') : extractErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="login-email">{t('auth.emailLabel')}</FieldLabel>
              <Input {...field} id="login-email" type="email" autoComplete="email" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="login-password">{t('auth.passwordLabel')}</FieldLabel>
              <Input {...field} id="login-password" type="password" autoComplete="current-password" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <TurnstileWidget
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          resetKey={turnstileResetKey}
        />
        {lockout.secondsRemaining !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {t('auth.accountLocked', { seconds: lockout.secondsRemaining })}
          </p>
        ) : (
          <FormError message={submitError} />
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || turnstileToken === null || lockout.secondsRemaining !== null}
        >
          {t('auth.signIn')}
        </Button>
      </FieldGroup>
    </form>
  )
}

export function Login() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  const redirectTo = sameOriginPath(searchParams.get('redirect')) ?? '/'
  useDocumentTitle(t('auth.signIn'))

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <main className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-fit">
            <Mascot className="h-19" />
          </div>
          <h1 className="text-2xl font-semibold">{t('common.appName')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.tagline')}</p>
        </div>
        <LoginForm redirectTo={redirectTo} />
      </main>
    </div>
  )
}
