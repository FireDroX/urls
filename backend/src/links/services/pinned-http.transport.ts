import { Injectable } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { LINK_CHECK_USER_AGENT } from '../../common/variables.global.js';

export interface PinnedRequest {
  url: URL;
  method: 'HEAD' | 'GET';
  address: string;
  signal: AbortSignal;
}

export interface PinnedResponse {
  status: number;
  location: string | null;
}

type LookupCallback = (
  error: Error | null,
  address: string | Array<{ address: string; family: number }>,
  family?: number,
) => void;

function pinnedLookup(address: string) {
  const family = isIP(address);
  return (
    _hostname: string,
    options: { all?: boolean },
    cb: LookupCallback,
  ) => {
    if (options.all) cb(null, [{ address, family }]);
    else cb(null, address, family);
  };
}

@Injectable()
export class PinnedHttpTransport {
  async resolve(hostname: string): Promise<string[]> {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  }

  send({
    url,
    method,
    address,
    signal,
  }: PinnedRequest): Promise<PinnedResponse> {
    const transport = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const request = transport.request(
        {
          host: url.hostname.replace(/^\[|\]$/g, ''),
          port: url.port || undefined,
          path: url.pathname + url.search,
          method,
          agent: false,
          signal,
          headers: { 'User-Agent': LINK_CHECK_USER_AGENT, Accept: '*/*' },
          lookup: pinnedLookup(address),
        },
        (response) => {
          const location = response.headers.location ?? null;
          const status = response.statusCode ?? 0;
          response.destroy();
          resolve({ status, location });
        },
      );
      request.on('error', reject);
      request.end();
    });
  }
}
