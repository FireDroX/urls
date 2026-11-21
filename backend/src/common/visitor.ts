import type { Request } from 'express';
import { resolveClientIp } from './client-ip.js';
import { COUNTRY_HEADER } from './variables.global.js';

export interface Visitor {
  ip: string | undefined;
  referer: string | undefined;
  userAgent: string | undefined;
  country: string | undefined;
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function describeVisitor(req: Request): Visitor {
  return {
    ip: resolveClientIp(req),
    referer: headerValue(req, 'referer'),
    userAgent: headerValue(req, 'user-agent'),
    country: headerValue(req, COUNTRY_HEADER),
  };
}
