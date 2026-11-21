import { InvalidEnvironmentException } from '../common/exceptions/config/invalid-environment.exception.js';
import {
  KNOWN_DEFAULT_SECRETS,
  MIN_IP_HASH_SECRET_LENGTH,
  MIN_JWT_SECRET_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../common/variables.global.js';

type RawEnvironment = Record<string, unknown>;

const MIN_STORAGE_SECRET_LENGTH = 16;

function readValue(config: RawEnvironment, key: string): string | undefined {
  const value = config[key];
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value;
}

function isKnownDefault(value: string): boolean {
  return KNOWN_DEFAULT_SECRETS.includes(value.trim().toLowerCase());
}

function secretProblems(
  key: string,
  value: string,
  minLength: number,
): string[] {
  if (isKnownDefault(value)) {
    return [`${key}: uses a well-known default value`];
  }
  if (value.length < minLength) {
    return [`${key}: must be at least ${minLength} characters long`];
  }
  return [];
}

function requiredSecret(
  config: RawEnvironment,
  key: string,
  minLength = 1,
): string[] {
  const value = readValue(config, key);
  if (value === undefined) {
    return [`${key}: is required`];
  }
  return secretProblems(key, value, minLength);
}

function optionalSecret(
  config: RawEnvironment,
  key: string,
  minLength: number,
): string[] {
  const value = readValue(config, key);
  return value === undefined ? [] : secretProblems(key, value, minLength);
}

function required(config: RawEnvironment, key: string): string[] {
  return readValue(config, key) === undefined ? [`${key}: is required`] : [];
}

function distinctJwtSecrets(config: RawEnvironment): string[] {
  const access = readValue(config, 'JWT_ACCESS_SECRET');
  const refresh = readValue(config, 'JWT_REFRESH_SECRET');
  if (access !== undefined && access === refresh) {
    return ['JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET'];
  }
  return [];
}

function httpUrlProblems(
  config: RawEnvironment,
  key: string,
  isRequired: boolean,
): string[] {
  const value = readValue(config, key);
  if (value === undefined) {
    return isRequired ? [`${key}: is required`] : [];
  }
  const protocol = URL.parse(value.trim())?.protocol;
  return protocol === 'http:' || protocol === 'https:'
    ? []
    : [`${key}: must be an http:// or https:// URL`];
}

function turnstileProblems(config: RawEnvironment): string[] {
  const servedOverHttps = readValue(config, 'PUBLIC_URL')
    ?.trim()
    .toLowerCase()
    .startsWith('https://');
  return servedOverHttps ? requiredSecret(config, 'TURNSTILE_SECRET_KEY') : [];
}

function isDevelopmentMode(config: RawEnvironment): boolean {
  return readValue(config, 'DEV')?.trim().toLowerCase() === 'true';
}

export function validateEnvironment(config: RawEnvironment): RawEnvironment {
  if (isDevelopmentMode(config)) {
    return config;
  }
  const problems = [
    ...httpUrlProblems(config, 'PUBLIC_URL', true),
    ...requiredSecret(config, 'JWT_ACCESS_SECRET', MIN_JWT_SECRET_LENGTH),
    ...requiredSecret(config, 'JWT_REFRESH_SECRET', MIN_JWT_SECRET_LENGTH),
    ...distinctJwtSecrets(config),
    ...requiredSecret(config, 'IP_HASH_SECRET', MIN_IP_HASH_SECRET_LENGTH),
    ...required(config, 'DB_HOST'),
    ...required(config, 'DB_USERNAME'),
    ...required(config, 'DB_DATABASE'),
    ...requiredSecret(config, 'DB_PASSWORD'),
    ...httpUrlProblems(config, 'S3_ENDPOINT', true),
    ...httpUrlProblems(config, 'S3_PUBLIC_ENDPOINT', false),
    ...required(config, 'S3_ACCESS_KEY'),
    ...required(config, 'S3_BUCKET'),
    ...requiredSecret(config, 'S3_SECRET_KEY', MIN_STORAGE_SECRET_LENGTH),
    ...optionalSecret(config, 'ADMIN_PASSWORD', MIN_PASSWORD_LENGTH),
    ...turnstileProblems(config),
  ];
  if (problems.length > 0) {
    throw new InvalidEnvironmentException(problems);
  }
  return config;
}
