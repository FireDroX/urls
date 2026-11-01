import { DefaultAdminConfigurationException } from '../common/exceptions/config/default-admin-configuration.exception.js';
import { hashPassword, isStrongPassword } from '../common/password.js';
import { EMAIL_REGEX } from '../common/variables.global.js';

export interface DefaultAdminSettings {
  email?: string;
  password?: string;
}

export interface NewDefaultAdmin {
  email: string;
  passwordHash: string;
}

export interface DefaultAdminStore {
  countUsers(): Promise<number>;
  createUser(admin: NewDefaultAdmin): Promise<void>;
}

export type DefaultAdminOutcome = 'created' | 'already-present';

export function defaultAdminSettingsFromEnv(
  env: Record<string, string | undefined>,
): DefaultAdminSettings {
  return {
    email: env.ADMIN_EMAIL?.trim().toLowerCase() || undefined,
    password: env.ADMIN_PASSWORD?.trim() ? env.ADMIN_PASSWORD : undefined,
  };
}

function problemsOf(settings: DefaultAdminSettings): string[] {
  const problems: string[] = [];
  if (!settings.email) {
    problems.push('ADMIN_EMAIL: is required');
  } else if (!EMAIL_REGEX.test(settings.email)) {
    problems.push('ADMIN_EMAIL: must be a valid email address');
  }
  if (!settings.password) {
    problems.push('ADMIN_PASSWORD: is required');
  } else if (!isStrongPassword(settings.password)) {
    problems.push(
      'ADMIN_PASSWORD: needs 12+ characters with an uppercase letter, a lowercase letter, a digit and a symbol',
    );
  }
  return problems;
}

export async function ensureDefaultAdmin(
  store: DefaultAdminStore,
  settings: DefaultAdminSettings,
): Promise<DefaultAdminOutcome> {
  if ((await store.countUsers()) > 0) {
    return 'already-present';
  }
  const problems = problemsOf(settings);
  if (problems.length > 0) {
    throw new DefaultAdminConfigurationException(problems);
  }
  await store.createUser({
    email: settings.email!,
    passwordHash: await hashPassword(settings.password!),
  });
  return 'created';
}
