import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventsCreatedAtIndex1794500000000 implements MigrationInterface {
  name = 'AddEventsCreatedAtIndex1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_events_created_at\` ON \`events\` (\`created_at\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_events_created_at\` ON \`events\``,
    );
  }
}
