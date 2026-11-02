import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkEvent } from '../entities/link-event.entity.js';
import type {
  LinkEventRepository,
  NewLinkEvent,
} from './link-event.repository.js';

@Injectable()
export class TypeormLinkEventRepository implements LinkEventRepository {
  constructor(
    @InjectRepository(LinkEvent)
    private readonly repository: Repository<LinkEvent>,
  ) {}

  async insert(event: NewLinkEvent): Promise<void> {
    await this.repository.save(this.repository.create(event));
  }
}
