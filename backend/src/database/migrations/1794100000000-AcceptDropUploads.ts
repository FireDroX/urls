import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcceptDropUploads1794100000000 implements MigrationInterface {
  name = 'AcceptDropUploads1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`files\` ADD \`uploader_name\` varchar(80) NULL AFTER \`name\`, ADD \`upload_token_hash\` char(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER \`upload_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP CONSTRAINT \`CHK_events_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD CONSTRAINT \`CHK_events_type\` CHECK (\`type\` IN ('click', 'view', 'download', 'upload'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM \`events\` WHERE \`type\` = 'upload'`);
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP CONSTRAINT \`CHK_events_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD CONSTRAINT \`CHK_events_type\` CHECK (\`type\` IN ('click', 'view', 'download'))`,
    );
    await queryRunner.query(
      `ALTER TABLE \`files\` DROP COLUMN \`upload_token_hash\`, DROP COLUMN \`uploader_name\``,
    );
  }
}
