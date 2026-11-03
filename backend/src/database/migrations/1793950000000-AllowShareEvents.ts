import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowShareEvents1793950000000 implements MigrationInterface {
  name = 'AllowShareEvents1793950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP CHECK \`CHK_events_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD CONSTRAINT \`CHK_events_type\` CHECK (\`type\` IN ('click', 'view', 'download'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`events\` WHERE \`type\` IN ('view', 'download')`,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP CHECK \`CHK_events_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD CONSTRAINT \`CHK_events_type\` CHECK (\`type\` IN ('click'))`,
    );
  }
}
