import { Inject, Injectable } from '@nestjs/common';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import type { LinkCheck } from '../entities/link-check.entity.js';
import type { Link } from '../entities/link.entity.js';
import type { LinkCheckRepository } from '../persistence/link-check.repository.js';
import { DestinationProbe } from './destination-probe.service.js';
import { LinksService } from './links.service.js';

export interface LinkCheckReport {
  link: Link;
  check: LinkCheck;
}

@Injectable()
export class LinkChecksService {
  constructor(
    private readonly linksService: LinksService,
    private readonly probe: DestinationProbe,
    @Inject('LinkChecksRepository')
    private readonly repository: LinkCheckRepository,
  ) {}

  async check(publicId: string): Promise<LinkCheckReport> {
    const link = await this.linksService.get(publicId);
    return { link, check: await this.checkLink(link) };
  }

  async checkLink(link: Link): Promise<LinkCheck> {
    if (!link.destination) throw new LinkNotFoundException();
    const result = await this.probe.check(link.destination);
    return this.repository.record(link.id, result, new Date());
  }
}
