import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { isPublicAddress } from '../../common/network-address.js';
import {
  LINK_CHECK_GET_FALLBACK_STATUSES,
  LINK_CHECK_MAX_REDIRECTS,
  LINK_CHECK_REDIRECT_STATUSES,
  LINK_CHECK_TIMEOUT_MS,
  LINK_DESTINATION_PROTOCOLS,
  type LinkCheckErrorKind,
} from '../../common/variables.global.js';
import type { LinkCheckResult } from '../link-check-result.js';
import {
  PinnedHttpTransport,
  type PinnedResponse,
} from './pinned-http.transport.js';

const SKIPPED: LinkCheckResult = {
  outcome: 'skipped',
  statusCode: null,
  errorKind: null,
};

const TLS_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

class ProbeFailure extends Error {
  constructor(readonly errorKind: LinkCheckErrorKind) {
    super(errorKind);
    this.name = 'ProbeFailure';
  }
}

class ProbeSkipped extends Error {
  constructor() {
    super('skipped');
    this.name = 'ProbeSkipped';
  }
}

@Injectable()
export class DestinationProbe {
  constructor(private readonly transport: PinnedHttpTransport) {}

  async check(destination: string): Promise<LinkCheckResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
    try {
      return await this.follow(destination, controller.signal);
    } catch (error) {
      return this.toResult(error, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private async follow(
    destination: string,
    signal: AbortSignal,
  ): Promise<LinkCheckResult> {
    let url = parseHttpUrl(destination);
    if (!url) return SKIPPED;
    for (let redirects = 0; ; redirects++) {
      const response = await this.fetchHop(url, signal);
      const location = redirectLocation(response);
      if (location === null) return toFinalResult(response.status);
      if (redirects >= LINK_CHECK_MAX_REDIRECTS) {
        throw new ProbeFailure('too_many_redirects');
      }
      url = parseHttpUrl(location, url);
      if (!url) throw new ProbeFailure('invalid_redirect');
    }
  }

  private async fetchHop(
    url: URL,
    signal: AbortSignal,
  ): Promise<PinnedResponse> {
    const addresses = await this.addressesOf(url, signal);
    if (!addresses.every(isPublicAddress)) throw new ProbeSkipped();
    const request = { url, address: addresses[0], signal };
    const head = await this.transport.send({ ...request, method: 'HEAD' });
    if (!LINK_CHECK_GET_FALLBACK_STATUSES.includes(head.status)) return head;
    return this.transport.send({ ...request, method: 'GET' });
  }

  private async addressesOf(url: URL, signal: AbortSignal): Promise<string[]> {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host)) return [host];
    let addresses: string[];
    try {
      addresses = await raceAbort(this.transport.resolve(host), signal);
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProbeFailure('dns');
    }
    if (addresses.length === 0) throw new ProbeFailure('dns');
    return addresses;
  }

  private toResult(error: unknown, signal: AbortSignal): LinkCheckResult {
    if (error instanceof ProbeSkipped) return SKIPPED;
    const errorKind =
      error instanceof ProbeFailure
        ? error.errorKind
        : signal.aborted
          ? 'timeout'
          : transportErrorKind(error);
    return { outcome: 'broken', statusCode: null, errorKind };
  }
}

function parseHttpUrl(value: string, base?: URL): URL | null {
  try {
    const url = new URL(value, base);
    return LINK_DESTINATION_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function redirectLocation(response: PinnedResponse): string | null {
  const redirects = LINK_CHECK_REDIRECT_STATUSES.includes(response.status);
  return redirects ? response.location : null;
}

function toFinalResult(status: number): LinkCheckResult {
  if (status >= 200 && status <= 399) {
    return { outcome: 'ok', statusCode: status, errorKind: null };
  }
  if (status >= 400 && status <= 599) {
    return { outcome: 'broken', statusCode: status, errorKind: null };
  }
  return { outcome: 'broken', statusCode: null, errorKind: 'connection' };
}

function transportErrorKind(error: unknown): LinkCheckErrorKind {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return 'connection';
  const isTls =
    code.startsWith('CERT_') ||
    code.startsWith('ERR_TLS') ||
    code.startsWith('ERR_SSL') ||
    TLS_ERROR_CODES.has(code);
  return isTls ? 'tls' : 'connection';
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    signal.addEventListener('abort', () => reject(new Error('aborted')), {
      once: true,
    });
    promise.then(resolve, reject);
  });
}
