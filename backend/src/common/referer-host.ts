import {
  EVENT_REFERER_HOST_MAX_LENGTH,
  EVENT_REFERER_PROTOCOLS,
} from './variables.global.js';

export function refererHost(referer: string | undefined): string | null {
  if (!referer || !URL.canParse(referer)) {
    return null;
  }
  const { protocol, hostname } = new URL(referer);
  if (!EVENT_REFERER_PROTOCOLS.includes(protocol) || !hostname) {
    return null;
  }
  return hostname.slice(0, EVENT_REFERER_HOST_MAX_LENGTH);
}
