import { Inject, Injectable } from '@nestjs/common';
import { dropState } from '../../common/drop-state.js';
import { DropExpiredException } from '../../common/exceptions/drops/drop-expired.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { isWellFormedLinkId } from '../../common/public-id.js';
import type { Visitor } from '../../common/visitor.js';
import { EventsService } from '../../events/services/events.service.js';
import { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { DropRepository } from '../persistence/drop.repository.js';

export interface PublicDropView {
  drop: Link;
  filesRemaining: number;
  bytesRemaining: number;
}

@Injectable()
export class PublicDropsService {
  constructor(
    @Inject('DropsRepository')
    private readonly repository: DropRepository,
    private readonly files: FilesService,
    private readonly events: EventsService,
  ) {}

  async view(publicId: string, visitor: Visitor): Promise<PublicDropView> {
    if (!isWellFormedLinkId(publicId)) {
      throw new DropNotFoundException();
    }
    const drop = await this.repository.findByPublicId(publicId);
    if (!drop || drop.disabled) {
      throw new DropNotFoundException();
    }
    const usages = await this.files.summarizeCountedLinks([drop.id]);
    const usage = usages.get(drop.id) ?? { fileCount: 0, totalSize: 0 };
    if (dropState(drop, usage, new Date()) !== 'open') {
      throw new DropExpiredException();
    }
    void this.events.recordView(drop.id, visitor);
    return {
      drop,
      filesRemaining: (drop.maxFiles ?? 0) - usage.fileCount,
      bytesRemaining: (drop.maxTotalBytes ?? 0) - usage.totalSize,
    };
  }
}
