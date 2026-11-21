import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';
import { FilesService } from './files.service.js';

describe('FilesService', () => {
  let repository: {
    findByLinkId: ReturnType<typeof vi.fn>;
    summarizeByLinkIds: ReturnType<typeof vi.fn>;
    summarizeCountedByLinkIds: ReturnType<typeof vi.fn>;
  };
  let service: FilesService;

  beforeEach(() => {
    repository = {
      findByLinkId: vi.fn().mockResolvedValue([]),
      summarizeByLinkIds: vi.fn().mockResolvedValue([]),
      summarizeCountedByLinkIds: vi.fn().mockResolvedValue([]),
    };
    service = new FilesService(repository as unknown as StoredFileRepository);
  });

  it('summarizes the counted files only, with zero for links without any', async () => {
    repository.summarizeCountedByLinkIds.mockResolvedValue([
      { linkId: 'a', fileCount: 1, totalSize: 40 },
    ]);

    const summaries = await service.summarizeCountedLinks(['a', 'b']);

    expect(repository.summarizeByLinkIds).not.toHaveBeenCalled();
    expect(summaries).toEqual(
      new Map([
        ['a', { fileCount: 1, totalSize: 40 }],
        ['b', { fileCount: 0, totalSize: 0 }],
      ]),
    );
  });

  it('lists the files of a link', async () => {
    await service.listForLink('link-uuid');

    expect(repository.findByLinkId).toHaveBeenCalledWith('link-uuid');
  });

  it('summarizes every requested link, with zero for links without files', async () => {
    repository.summarizeByLinkIds.mockResolvedValue([
      { linkId: 'a', fileCount: 3, totalSize: 1200 },
    ]);

    const summaries = await service.summarizeLinks(['a', 'b']);

    expect(summaries).toEqual(
      new Map([
        ['a', { fileCount: 3, totalSize: 1200 }],
        ['b', { fileCount: 0, totalSize: 0 }],
      ]),
    );
  });
});
