import { Inject, Injectable } from '@nestjs/common';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type {
  FilesSummary,
  StoredFileRepository,
} from '../persistence/stored-file.repository.js';

export type LinkFilesSummary = Omit<FilesSummary, 'linkId'>;

const EMPTY_SUMMARY: LinkFilesSummary = { fileCount: 0, totalSize: 0 };

@Injectable()
export class FilesService {
  constructor(
    @Inject('FilesRepository')
    private readonly repository: StoredFileRepository,
  ) {}

  listForLink(linkId: string): Promise<StoredFile[]> {
    return this.repository.findByLinkId(linkId);
  }

  async summarizeLinks(
    linkIds: string[],
  ): Promise<Map<string, LinkFilesSummary>> {
    const rows = await this.repository.summarizeByLinkIds(linkIds);
    const byLink = new Map(
      rows.map(({ linkId, fileCount, totalSize }) => [
        linkId,
        { fileCount, totalSize },
      ]),
    );
    return new Map(
      linkIds.map((linkId) => [linkId, byLink.get(linkId) ?? EMPTY_SUMMARY]),
    );
  }
}
