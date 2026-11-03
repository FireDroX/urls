import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';
import { FilesService } from './files.service.js';

describe('FilesService', () => {
  let repository: {
    findByLinkId: ReturnType<typeof vi.fn>;
    summarizeByLinkIds: ReturnType<typeof vi.fn>;
  };
  let service: FilesService;

  beforeEach(() => {
    repository = {
      findByLinkId: vi.fn().mockResolvedValue([]),
      summarizeByLinkIds: vi.fn().mockResolvedValue([]),
    };
    service = new FilesService(repository as unknown as StoredFileRepository);
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
