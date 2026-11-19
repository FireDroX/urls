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
  'all',
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

export const DB_DEFAULT_PORT = 3306;
export const DB_DRIVER_TIME_ZONE = 'Z';
export const DB_SESSION_TIME_ZONE = '+00:00';

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
  'all',
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
export const LINK_TAGS_MAX = 20;
export const LINK_CREATE_THROTTLE_TTL_MS = 60_000;
export const LINK_CREATE_THROTTLE_LIMIT = 20;
export const LINK_REDIRECT_THROTTLE_TTL_MS = 60_000;
export const LINK_REDIRECT_THROTTLE_LIMIT = 30;
export const LINK_CHECK_THROTTLE_TTL_MS = 60_000;
export const LINK_CHECK_THROTTLE_LIMIT = 10;
export const LINK_CHECK_TIMEOUT_MS = 10_000;
export const LINK_CHECK_MAX_REDIRECTS = 5;
export const LINK_CHECK_USER_AGENT = 'Mozilla/5.0 (compatible; link-checker)';
export const LINK_CHECK_OUTCOMES = ['ok', 'broken', 'skipped'] as const;
export type LinkCheckOutcome = (typeof LINK_CHECK_OUTCOMES)[number];
export const LINK_CHECK_ERROR_KINDS = [
  'dns',
  'connection',
  'tls',
  'timeout',
  'too_many_redirects',
  'invalid_redirect',
] as const;
export type LinkCheckErrorKind = (typeof LINK_CHECK_ERROR_KINDS)[number];
export const LINK_CHECK_REDIRECT_STATUSES: readonly number[] = [
  301, 302, 303, 307, 308,
];
export const LINK_CHECK_GET_FALLBACK_STATUSES: readonly number[] = [405, 501];
export const LINK_CHECK_CRON = '0 4 * * *';
export const LINK_CHECK_BATCH_SIZE = 50;
export const LINK_CHECK_DELAY_MS = 1_000;
export const PUBLIC_LINK_CACHE_CONTROL = 'no-store';

export const SHARE_MAX_DOWNLOADS_LIMIT = 1_000_000;
export const SHARE_FILES_MAX = 50;
export const DROP_TITLE_MAX_LENGTH = 120;
export const DROP_STATES = ['open', 'full', 'expired', 'disabled'] as const;
export type DropState = (typeof DROP_STATES)[number];
export const SHARE_VIEW_THROTTLE_TTL_MS = 60_000;
export const SHARE_VIEW_THROTTLE_LIMIT = 30;
export const DROP_VIEW_THROTTLE_TTL_MS = 60_000;
export const DROP_VIEW_THROTTLE_LIMIT = 30;
export const SHARE_DOWNLOAD_THROTTLE_TTL_MS = 60_000;
export const SHARE_DOWNLOAD_THROTTLE_LIMIT = 10;
export const SHARE_DOWNLOAD_URL_TTL_SECONDS = 60;
export const FILE_DOWNLOAD_URL_TTL_SECONDS = 60;
export const FILE_STATUSES = [
  'uploading',
  'verifying',
  'ready',
  'rejected',
] as const;
export const FILE_NAME_INPUT_MAX_LENGTH = 1024;
export const FILE_NAME_MAX_LENGTH = 255;
export const FILE_PUBLIC_ID_MAX_LENGTH = 16;
export const FILE_MIN_SIZE_BYTES = 1;
export const FILE_MAX_SIZE_BYTES = 20 * 1024 ** 3;
export const FILE_PART_SIZE_BYTES = 32 * 1024 ** 2;
export const FILES_STORAGE_QUOTA_BYTES = 75 * 1024 ** 3;
export const FILE_SHA256_REGEX = /^[0-9a-f]{64}$/;
export const FILE_HASH_ALGORITHM = 'sha256';
export const FILE_S3_KEY_PREFIX = 'files/';
export const FILE_UNKNOWN_MIME = 'application/octet-stream';
export const FILE_MIME_SNIFF_BYTES = 64 * 1024;
export const FILE_PART_UPLOAD_PATH_REGEX =
  /^\/api\/(?:shares|public\/drops)\/[^/?]+\/files\/[^/?]+\/parts\/[^/?]+\/?(?:\?|$)/;
export const DROP_UPLOADER_NAME_MAX_LENGTH = 80;
export const DROP_UPLOAD_TOKEN_BYTES = 32;
export const DROP_UPLOAD_TOKEN_LENGTH = 43;
export const DROP_UPLOAD_TOKEN_HEADER = 'x-upload-token';
export const DROP_UPLOAD_TOKEN_HASH_ALGORITHM = 'sha256';
export const DROP_UPLOAD_THROTTLE_TTL_MS = 60_000;
export const DROP_UPLOAD_START_THROTTLE_LIMIT = 10;
export const DROP_UPLOAD_PART_THROTTLE_LIMIT = 120;
export const FILE_UPLOAD_THROTTLE_TTL_MS = 60_000;
export const FILE_START_THROTTLE_LIMIT = 60;
export const FILE_PART_THROTTLE_LIMIT = 300;
export const S3_LIST_PARTS_PAGE_SIZE = 1000;

export const EVENT_TYPES = ['click', 'view', 'download', 'upload'] as const;
export const EVENT_REFERER_MAX_LENGTH = 2048;
export const EVENT_USER_AGENT_MAX_LENGTH = 512;
export const EVENT_REFERER_HOST_MAX_LENGTH = 255;
export const EVENT_REFERER_PROTOCOLS: readonly string[] = ['http:', 'https:'];
export const IP_HASH_ALGORITHM = 'sha256';
export const COUNTRY_HEADER = 'cf-ipcountry';
export const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
export const UNKNOWN_COUNTRY_CODES: readonly string[] = ['XX', 'T1'];

export const EVENTS_RETENTION_DAYS = 90;
export const EVENTS_PURGE_CRON = '30 3 * * *';
export const EVENTS_PURGE_BATCH_SIZE = 1000;
export const LINK_STATS_DEFAULT_DAYS = 30;
export const LINK_STATS_MIN_DAYS = 1;
export const LINK_STATS_MAX_DAYS = EVENTS_RETENTION_DAYS;
export const LINK_STATS_TOP_LIMIT = 10;
export const LINK_STATS_TIME_ZONE = 'UTC';
export const UNSIGNED_INTEGER_REGEX = /^\d+$/;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const JSON_BODY_LIMIT = '100kb';
export const JSON_CONTENT_TYPE_REGEX = /^application\/json\s*(?:;|$)/i;

export const AUDIT_LOG_STRING_MAX_LENGTH = 500;

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TIMEOUT_MS = 5000;
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

export const S3_ADMIN_TIMEOUT_MS = 5000;
export const S3_DEFAULT_REGION = 'us-east-1';
export const S3_CHECKSUM_MODE = 'WHEN_REQUIRED';

export const SUPPORTED_LOCALES: readonly string[] = ['fr', 'en'];
export const DEFAULT_LOCALE = 'fr';
export const SETTING_VALUE_MAX_LENGTH = 255;

export const TAG_NAME_MAX_LENGTH = 50;
export const TAG_COLOR_REGEX = /^#[0-9a-f]{6}$/;
export const DEFAULT_TAG_COLOR = '#6b7280';

export const FOLDER_NAME_MAX_LENGTH = 100;

export const LIST_SEARCH_MAX_LENGTH = 100;
export const LIST_PAGE_SIZE_DEFAULT = 50;
export const LIST_PAGE_SIZE_MAX = 100;
export const LIST_PAGE_MAX = 100_000;
export const LIST_FOLDER_NONE = 'none';
export const LIST_LIKE_ESCAPE = '!';
export const LINK_LIST_SORTS = [
  'created_desc',
  'created_asc',
  'updated_desc',
  'slug_asc',
  'slug_desc',
] as const;
export type LinkListSort = (typeof LINK_LIST_SORTS)[number];
export const LINK_LIST_STATES = ['active', 'disabled', 'expired'] as const;
export type LinkListState = (typeof LINK_LIST_STATES)[number];
export const ALL_LINKS_LIST_STATES = [
  'active',
  'disabled',
  'expired',
  'full',
] as const;
export type AllLinksListState = (typeof ALL_LINKS_LIST_STATES)[number];
