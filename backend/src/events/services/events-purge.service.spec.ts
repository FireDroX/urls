import { Logger } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  EVENTS_PURGE_BATCH_SIZE,
  EVENTS_RETENTION_DAYS,
  MS_PER_DAY,
} from '../../common/variables.global.js';
import { EventsPurgeService } from './events-purge.service.js';

const NOW = new Date('2026-11-17T03:30:00.000Z');

describe('EventsPurgeService', () => {
  let repository: { deleteOlderThan: ReturnType<typeof vi.fn> };
  let service: EventsPurgeService;
  let log: MockInstance;
  let warn: MockInstance;
  let error: MockInstance;

  beforeEach(() => {
    repository = { deleteOlderThan: vi.fn().mockResolvedValue(0) };
    service = new EventsPurgeService(repository as never);
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('purges events older than the retention period only', async () => {
    await service.run(NOW);

    const [cutoff, limit] = repository.deleteOlderThan.mock.calls[0] as [
      Date,
      number,
    ];
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff.getTime()).toBe(
      NOW.getTime() - EVENTS_RETENTION_DAYS * MS_PER_DAY,
    );
    expect(limit).toBe(EVENTS_PURGE_BATCH_SIZE);
    const keptAt89Days = new Date(NOW.getTime() - 89 * MS_PER_DAY);
    const purgedAt91Days = new Date(NOW.getTime() - 91 * MS_PER_DAY);
    expect(keptAt89Days.getTime() < cutoff.getTime()).toBe(false);
    expect(purgedAt91Days.getTime() < cutoff.getTime()).toBe(true);
  });

  it('deletes in successive batches until exhausted', async () => {
    repository.deleteOlderThan
      .mockResolvedValueOnce(EVENTS_PURGE_BATCH_SIZE)
      .mockResolvedValueOnce(EVENTS_PURGE_BATCH_SIZE)
      .mockResolvedValueOnce(3);

    const summary = await service.run(NOW);

    expect(repository.deleteOlderThan).toHaveBeenCalledTimes(3);
    expect(summary).toMatchObject({
      deleted: 2 * EVENTS_PURGE_BATCH_SIZE + 3,
      batches: 3,
    });
  });

  it('stops after one batch when nothing is left', async () => {
    const summary = await service.run(NOW);

    expect(repository.deleteOlderThan).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ deleted: 0, batches: 1 });
  });

  it('skips a pass that starts while the previous one runs', async () => {
    let release: (count: number) => void = () => {};
    repository.deleteOlderThan.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        release = resolve;
      }),
    );

    const first = service.run(NOW);
    const second = await service.run(NOW);

    expect(second).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(repository.deleteOlderThan).toHaveBeenCalledTimes(1);

    release(0);
    await first;
    await service.run(NOW);
    expect(repository.deleteOlderThan).toHaveBeenCalledTimes(2);
  });

  it('logs the error by name only and releases the lock', async () => {
    repository.deleteOlderThan.mockRejectedValueOnce(
      new Error('SELECT secret 203.0.113.7'),
    );

    await expect(service.run(NOW)).resolves.toBeNull();

    expect(error).toHaveBeenCalledTimes(1);
    const message = String(error.mock.calls[0][0]);
    expect(message).toContain('Error');
    expect(message).not.toContain('203.0.113.7');
    expect(message).not.toContain('SELECT');
    await service.run(NOW);
    expect(repository.deleteOlderThan).toHaveBeenCalledTimes(2);
  });

  it('logs one summary line with counts only', async () => {
    repository.deleteOlderThan.mockResolvedValueOnce(5);

    await service.run(NOW);

    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toMatch(
      /^Events purge done: deleted=5 batches=1 durationMs=\d+$/,
    );
  });
});
