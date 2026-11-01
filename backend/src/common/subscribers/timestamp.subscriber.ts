import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
} from 'typeorm';

@EventSubscriber()
export class TimestampSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<ObjectLiteral>): void {
    const column = event.metadata.createDateColumn;
    if (column && column.getEntityValue(event.entity) === undefined) {
      column.setEntityValue(event.entity, new Date());
    }
  }
}
