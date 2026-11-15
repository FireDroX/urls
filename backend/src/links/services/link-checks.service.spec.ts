import { describe, expect, it, vi } from 'vitest';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import type { LinkCheck } from '../entities/link-check.entity.js';
import type { Link } from '../entities/link.entity.js';
import type { DestinationProbe } from './destination-probe.service.js';
import { LinkChecksService } from './link-checks.service.js';
import type { LinksService } from './links.service.js';

const link = {
  id: 'uuid-1',
  publicId: 'abc123',
  destination: 'https://example.com/',
} as Link;

function build() {
  const linksService = { get: vi.fn().mockResolvedValue(link) };
  const result = { outcome: 'ok', statusCode: 200, errorKind: null };
  const probe = { check: vi.fn().mockResolvedValue(result) };
  const check = { linkId: link.id, ...result } as LinkCheck;
  const repository = { record: vi.fn().mockResolvedValue(check) };
  const service = new LinkChecksService(
    linksService as unknown as LinksService,
    probe as unknown as DestinationProbe,
    repository,
  );
  return { service, linksService, probe, repository, result, check };
}

describe('LinkChecksService', () => {
  it('records the probe result under the internal id and returns it', async () => {
    const { service, probe, repository, result, check } = build();

    const outcome = await service.check('abc123');

    expect(probe.check).toHaveBeenCalledWith('https://example.com/');
    expect(repository.record).toHaveBeenCalledWith(
      'uuid-1',
      result,
      expect.any(Date),
    );
    expect(outcome).toEqual({ link, check });
  });

  it('checkLink probes the destination and records the result', async () => {
    const { service, linksService, probe, repository, result, check } = build();

    expect(await service.checkLink(link)).toBe(check);

    expect(linksService.get).not.toHaveBeenCalled();
    expect(probe.check).toHaveBeenCalledWith('https://example.com/');
    expect(repository.record).toHaveBeenCalledWith(
      'uuid-1',
      result,
      expect.any(Date),
    );
  });

  it('does not probe an unknown, deleted or malformed redirect', async () => {
    const { service, linksService, probe, repository } = build();
    linksService.get.mockRejectedValue(new LinkNotFoundException());

    await expect(service.check('nope')).rejects.toBeInstanceOf(
      LinkNotFoundException,
    );
    expect(probe.check).not.toHaveBeenCalled();
    expect(repository.record).not.toHaveBeenCalled();
  });

  it('treats a link without destination as not found', async () => {
    const { service, linksService, probe } = build();
    linksService.get.mockResolvedValue({ ...link, destination: null });

    await expect(service.check('abc123')).rejects.toBeInstanceOf(
      LinkNotFoundException,
    );
    expect(probe.check).not.toHaveBeenCalled();
  });
});
