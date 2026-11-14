import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import {
  LINK_CHECK_BATCH_SIZE,
  LINK_CHECK_DELAY_MS,
} from '../../common/variables.global.js';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import type { LinkCheck } from '../entities/link-check.entity.js';
import type { Link } from '../entities/link.entity.js';
import { LinkCheckSweepService } from './link-check-sweep.service.js';
import type { LinkChecksService } from './link-checks.service.js';
import type { LinksService } from './links.service.js';

const DESTINATION = 'https://secret-host.example/private?token=abc';

const links = ['a', 'b', 'c'].map(
  (publicId) => ({ publicId, destination: DESTINATION }) as Link,
);

const checkOf = (outcome: string) => ({ outcome }) as LinkCheck;

describe('LinkCheckSweepService', () => {
  let linksService: {
    listDueForCheck: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  let checks: { checkLink: ReturnType<typeof vi.fn> };
  let service: LinkCheckSweepService;
  let log: MockInstance<(message: string) => void>;
  let warn: MockInstance<(message: string) => void>;
  let error: MockInstance<(message: string) => void>;

  const loggedText = () =>
    JSON.stringify([log, warn, error].flatMap((spy) => spy.mock.calls));

  beforeEach(() => {
    vi.useFakeTimers();
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    linksService = {
      listDueForCheck: vi.fn().mockResolvedValue(links),
      get: vi.fn((publicId: string) =>
        Promise.resolve(links.find((item) => item.publicId === publicId)),
      ),
    };
    checks = { checkLink: vi.fn().mockResolvedValue(checkOf('ok')) };
    service = new LinkCheckSweepService(
      linksService as unknown as LinksService,
      checks as unknown as LinkChecksService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('skips a pass while the previous one is still running, then runs again', async () => {
    let release: (value: Link[]) => void = () => undefined;
    linksService.listDueForCheck.mockReturnValueOnce(
      new Promise<Link[]>((resolve) => (release = resolve)),
    );

    const first = service.run();
    expect(await service.run()).toBeNull();
    expect(linksService.listDueForCheck).toHaveBeenCalledTimes(1);
    expect(checks.checkLink).not.toHaveBeenCalled();

    release([]);
    await first;
    linksService.listDueForCheck.mockResolvedValue([]);
    expect(await service.run()).not.toBeNull();
    expect(linksService.listDueForCheck).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when listing the links fails', async () => {
    linksService.listDueForCheck.mockRejectedValueOnce(new Error(DESTINATION));

    expect(await service.run()).toBeNull();
    expect(loggedText()).not.toContain('secret-host');

    const run = service.run();
    await vi.runAllTimersAsync();
    expect(await run).not.toBeNull();
  });

  it('asks for one batch of links', async () => {
    const run = service.run();
    await vi.runAllTimersAsync();
    await run;

    expect(linksService.listDueForCheck).toHaveBeenCalledWith(
      LINK_CHECK_BATCH_SIZE,
    );
  });

  it('checks the links one at a time, in order, with a delay between them', async () => {
    const run = service.run();
    await vi.advanceTimersByTimeAsync(0);
    expect(checks.checkLink).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(LINK_CHECK_DELAY_MS - 1);
    expect(checks.checkLink).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(checks.checkLink).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(LINK_CHECK_DELAY_MS);
    await run;
    expect(
      (checks.checkLink.mock.calls as [Link][]).map(([link]) => link.publicId),
    ).toEqual(['a', 'b', 'c']);
  });

  it('does not wait after the last link', async () => {
    linksService.listDueForCheck.mockResolvedValue([links[0]]);

    const summary = await service.run();

    expect(summary).toMatchObject({ checked: 1 });
  });

  it('keeps going after an error and never logs the destination', async () => {
    checks.checkLink
      .mockResolvedValueOnce(checkOf('ok'))
      .mockRejectedValueOnce(new Error(`failed for ${DESTINATION}`))
      .mockResolvedValueOnce(checkOf('broken'));

    const run = service.run();
    await vi.runAllTimersAsync();
    const summary = await run;

    expect(checks.checkLink).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      checked: 2,
      ok: 1,
      broken: 1,
      skipped: 0,
      gone: 0,
      errors: 1,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('Link check failed for b: Error');
    expect(loggedText()).not.toContain('secret-host');
    expect(loggedText()).not.toContain('token');
  });

  it('logs one summary with the counts only', async () => {
    checks.checkLink
      .mockResolvedValueOnce(checkOf('ok'))
      .mockResolvedValueOnce(checkOf('skipped'))
      .mockResolvedValueOnce(checkOf('broken'));

    const run = service.run();
    await vi.runAllTimersAsync();
    await run;

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toBe(
      'Link check pass done: checked=3 ok=1 broken=1 skipped=1 gone=0 errors=0',
    );
  });

  it('probes the redirect as it is now, not as it was when the batch was read', async () => {
    const edited = {
      publicId: 'a',
      destination: 'https://new.example',
    } as Link;
    linksService.get.mockResolvedValueOnce(edited);
    linksService.listDueForCheck.mockResolvedValue([links[0]]);

    await service.run();

    expect(linksService.get).toHaveBeenCalledWith('a');
    expect(checks.checkLink).toHaveBeenCalledWith(edited);
  });

  it('skips a redirect deleted or changed type during the pass, without probing it', async () => {
    linksService.get
      .mockResolvedValueOnce(links[0])
      .mockRejectedValueOnce(new LinkNotFoundException())
      .mockResolvedValueOnce(links[2]);

    const run = service.run();
    await vi.runAllTimersAsync();
    const summary = await run;

    expect(
      (checks.checkLink.mock.calls as [Link][]).map(([link]) => link.publicId),
    ).toEqual(['a', 'c']);
    expect(summary).toEqual({
      checked: 2,
      ok: 2,
      broken: 0,
      skipped: 0,
      gone: 1,
      errors: 0,
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
