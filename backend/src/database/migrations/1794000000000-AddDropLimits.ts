import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDropLimits1794000000000 implements MigrationInterface {
  name = 'AddDropLimits1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`links\` ADD \`title\` varchar(120) NULL AFTER \`destination\`, ADD \`max_total_bytes\` bigint unsigned NULL AFTER \`download_count\`, ADD \`max_files\` int unsigned NULL AFTER \`max_total_bytes\`, ADD CONSTRAINT \`CHK_links_drop_max_total_bytes\` CHECK ((\`type\` = 'drop' AND \`max_total_bytes\` IS NOT NULL AND \`max_total_bytes\` > 0) OR (\`type\` <> 'drop' AND \`max_total_bytes\` IS NULL)), ADD CONSTRAINT \`CHK_links_drop_max_files\` CHECK ((\`type\` = 'drop' AND \`max_files\` IS NOT NULL AND \`max_files\` > 0) OR (\`type\` <> 'drop' AND \`max_files\` IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`links\` DROP CONSTRAINT \`CHK_links_drop_max_files\`, DROP CONSTRAINT \`CHK_links_drop_max_total_bytes\`, DROP COLUMN \`max_files\`, DROP COLUMN \`max_total_bytes\`, DROP COLUMN \`title\``,
    );
  }
}
