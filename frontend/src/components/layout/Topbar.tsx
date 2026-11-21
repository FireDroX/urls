import { LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { LogoMark, Wordmark } from '#components/Logo'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { useAuth } from '#hooks/useAuth'

function initialsOf(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export function Topbar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const navigate = useNavigate()
  const isDark = resolvedTheme === 'dark'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <Link to="/" className="flex items-center gap-2 text-foreground no-underline">
        <LogoMark size={28} />
        <Wordmark />
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('layout.toggleTheme')}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full bg-state-neutral-bg text-[13px] text-foreground hover:bg-state-neutral-bg/80"
              aria-label={t('layout.account')}
            >
              {user ? initialsOf(user.email) : '?'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings />
              {t('layout.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut />
              {t('layout.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
