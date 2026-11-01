import type { Request } from 'express';

export function resolveClientIp(req: Request): string | undefined {
  const headerName = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (headerName) {
    const value = req.headers[headerName];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return req.ip;
}
