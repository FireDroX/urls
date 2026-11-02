export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 255;
export const MIN_PASSWORD_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;
export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const MIN_JWT_SECRET_LENGTH = 32;
export const MIN_IP_HASH_SECRET_LENGTH = 32;
export const KNOWN_DEFAULT_SECRETS: readonly string[] = [
  'changeme',
  'change-me',
  'minioadmin',
  'rustfsadmin',
  'password',
  'password123',
  'secret',
  'admin',
  'root',
  'urls',
];

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';
export const SESSION_ACCESS_TOKEN_TYPE = 'access';
export const SESSION_REFRESH_TOKEN_TYPE = 'refresh';
export const ACCESS_TOKEN_EXPIRATION = '15m';
export const REFRESH_TOKEN_EXPIRATION = '7d';
export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_CHANGE_CLOCK_TOLERANCE_MS = 1000;

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_DURATION_MINUTES = 15;

export const GLOBAL_THROTTLE_TTL_MS = 60_000;
export const GLOBAL_THROTTLE_LIMIT = 100;
export const LOGIN_THROTTLE_TTL_MS = 60_000;
export const LOGIN_THROTTLE_LIMIT = 5;

export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

export const PUBLIC_ID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const PUBLIC_ID_LENGTH = 8;

export const PUBLIC_ID_GENERATION_ATTEMPTS = 5;

export const LINK_TYPES = ['redirect', 'share', 'drop'] as const;
export const LINK_DESTINATION_MAX_LENGTH = 2048;
export const LINK_DESTINATION_PROTOCOLS: readonly string[] = [
  'http:',
  'https:',
];
export const LINK_SLUG_MIN_LENGTH = 3;
export const LINK_SLUG_MAX_LENGTH = 64;
export const LINK_SLUG_REGEX = /^[A-Za-z0-9_-]+$/;
export const RESERVED_LINK_SLUGS: readonly string[] = [
  'account',
  'admin',
  'api',
  'assets',
  'd',
  'dashboard',
  'health',
  'links',
  'login',
  'logout',
  'new',
  'r',
  'settings',
  'static',
  'u',
];
export const LINK_CREATE_THROTTLE_TTL_MS = 60_000;
export const LINK_CREATE_THROTTLE_LIMIT = 20;
export const LINK_REDIRECT_THROTTLE_TTL_MS = 60_000;
export const LINK_REDIRECT_THROTTLE_LIMIT = 30;
export const PUBLIC_LINK_CACHE_CONTROL = 'no-store';

export const EVENT_TYPES = ['click'] as const;
export const EVENT_REFERER_MAX_LENGTH = 2048;
export const EVENT_USER_AGENT_MAX_LENGTH = 512;
export const IP_HASH_ALGORITHM = 'sha256';
export const COUNTRY_HEADER = 'cf-ipcountry';
export const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
export const UNKNOWN_COUNTRY_CODES: readonly string[] = ['XX', 'T1'];

export const LINK_STATS_DEFAULT_DAYS = 30;
export const LINK_STATS_MIN_DAYS = 1;
export const LINK_STATS_MAX_DAYS = 365;
export const LINK_STATS_TOP_LIMIT = 10;
export const LINK_STATS_TIME_ZONE = 'UTC';
export const UNSIGNED_INTEGER_REGEX = /^\d+$/;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const JSON_BODY_LIMIT = '100kb';

export const AUDIT_LOG_STRING_MAX_LENGTH = 500;

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TIMEOUT_MS = 5000;

export const S3_ADMIN_TIMEOUT_MS = 5000;
export const S3_DEFAULT_REGION = 'us-east-1';

export const SUPPORTED_LOCALES: readonly string[] = ['fr', 'en'];
export const DEFAULT_LOCALE = 'fr';
export const SETTING_VALUE_MAX_LENGTH = 255;
