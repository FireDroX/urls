import { describe, expect, it } from 'vitest';
import { InvalidEnvironmentException } from '../common/exceptions/config/invalid-environment.exception.js';
import { validateEnvironment } from './env.validation.js';

const STRONG_ACCESS = 'a'.repeat(16) + 'b'.repeat(16);
const STRONG_REFRESH = 'c'.repeat(16) + 'd'.repeat(16);

function validConfig(): Record<string, unknown> {
  return {
    PUBLIC_URL: 'https://url.example.org',
    JWT_ACCESS_SECRET: STRONG_ACCESS,
    JWT_REFRESH_SECRET: STRONG_REFRESH,
    IP_HASH_SECRET: 'e'.repeat(16) + 'f'.repeat(16),
    DB_HOST: 'mariadb',
    DB_USERNAME: 'urls_app',
    DB_DATABASE: 'urls',
    DB_PASSWORD: 'db-password-from-a-vault',
    S3_ENDPOINT: 'http://rustfs:9000',
    S3_ACCESS_KEY: 'urls_app',
    S3_BUCKET: 'urls',
    S3_SECRET_KEY: 'storage-secret-from-a-vault',
    TURNSTILE_SECRET_KEY: '0x4AAAAAAA-turnstile-secret',
  };
}

function problemsFor(config: Record<string, unknown>): string[] {
  try {
    validateEnvironment(config);
  } catch (error) {
    if (error instanceof InvalidEnvironmentException) {
      return error.problems;
    }
    throw error;
  }
  return [];
}

describe('validateEnvironment', () => {
  it('returns the configuration untouched when everything is acceptable', () => {
    const config = { ...validConfig(), PORT: '3000' };

    expect(validateEnvironment(config)).toBe(config);
  });

  it.each([
    'PUBLIC_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'IP_HASH_SECRET',
    'DB_HOST',
    'DB_USERNAME',
    'DB_DATABASE',
    'DB_PASSWORD',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY',
    'S3_BUCKET',
    'S3_SECRET_KEY',
  ])('rejects a missing %s', (key) => {
    const config = validConfig();
    delete config[key];

    expect(problemsFor(config)).toEqual([`${key}: is required`]);
  });

  it('treats a blank value as missing', () => {
    expect(problemsFor({ ...validConfig(), DB_PASSWORD: '   ' })).toEqual([
      'DB_PASSWORD: is required',
    ]);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(
      problemsFor({ ...validConfig(), JWT_ACCESS_SECRET: 'x'.repeat(31) }),
    ).toEqual(['JWT_ACCESS_SECRET: must be at least 32 characters long']);
  });

  it('rejects an IP hash secret shorter than 32 characters', () => {
    expect(
      problemsFor({ ...validConfig(), IP_HASH_SECRET: 'x'.repeat(31) }),
    ).toEqual(['IP_HASH_SECRET: must be at least 32 characters long']);
  });

  it('rejects a known default IP hash secret', () => {
    expect(
      problemsFor({ ...validConfig(), IP_HASH_SECRET: 'changeme' }),
    ).toEqual(['IP_HASH_SECRET: uses a well-known default value']);
  });

  it('rejects a short storage secret', () => {
    expect(
      problemsFor({ ...validConfig(), S3_SECRET_KEY: 'x'.repeat(15) }),
    ).toEqual(['S3_SECRET_KEY: must be at least 16 characters long']);
  });

  it.each(['changeme', 'minioadmin', 'rustfsadmin', ' Root '])(
    'rejects the known default value "%s"',
    (value) => {
      expect(problemsFor({ ...validConfig(), DB_PASSWORD: value })).toEqual([
        'DB_PASSWORD: uses a well-known default value',
      ]);
    },
  );

  it('rejects identical access and refresh secrets', () => {
    expect(
      problemsFor({ ...validConfig(), JWT_REFRESH_SECRET: STRONG_ACCESS }),
    ).toEqual(['JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET']);
  });

  it.each(['url.example.org', 'javascript:alert(1)', 'ftp://url.example.org'])(
    'rejects PUBLIC_URL %s',
    (value) => {
      expect(problemsFor({ ...validConfig(), PUBLIC_URL: value })).toEqual([
        'PUBLIC_URL: must be an http:// or https:// URL',
      ]);
    },
  );

  it('accepts a missing S3_PUBLIC_ENDPOINT but rejects an invalid one', () => {
    expect(problemsFor(validConfig())).toEqual([]);
    expect(
      problemsFor({ ...validConfig(), S3_PUBLIC_ENDPOINT: 'cdn.example.org' }),
    ).toEqual(['S3_PUBLIC_ENDPOINT: must be an http:// or https:// URL']);
  });

  it('rejects an ADMIN_PASSWORD that is too short or a known default', () => {
    expect(problemsFor({ ...validConfig(), ADMIN_PASSWORD: 'Ab1!' })).toEqual([
      'ADMIN_PASSWORD: must be at least 12 characters long',
    ]);
    expect(problemsFor({ ...validConfig(), ADMIN_PASSWORD: 'admin' })).toEqual([
      'ADMIN_PASSWORD: uses a well-known default value',
    ]);
  });

  it('requires TURNSTILE_SECRET_KEY only when the site is served over https', () => {
    const config = validConfig();
    delete config.TURNSTILE_SECRET_KEY;

    expect(problemsFor(config)).toEqual(['TURNSTILE_SECRET_KEY: is required']);
    expect(
      problemsFor({ ...config, PUBLIC_URL: 'http://localhost:5174' }),
    ).toEqual([]);
  });

  it('skips every check when DEV is true', () => {
    const config = { DEV: ' TRUE ', DB_PASSWORD: 'root' };

    expect(validateEnvironment(config)).toBe(config);
  });

  it('explains how to generate secrets in the error message', () => {
    expect(() => validateEnvironment({})).toThrow(/openssl rand -hex 32/);
  });
});
