import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFiles1793900000000 implements MigrationInterface {
  name = 'CreateFiles1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`links\` ADD \`max_downloads\` int unsigned NULL AFTER \`expires_at\`, ADD \`download_count\` int unsigned NOT NULL DEFAULT 0 AFTER \`max_downloads\`, ADD CONSTRAINT \`CHK_links_max_downloads\` CHECK (\`max_downloads\` IS NULL OR (\`type\` = 'share' AND \`max_downloads\` > 0))`,
    );
    await queryRunner.query(
      `CREATE TABLE \`files\` (\`id\` varchar(36) NOT NULL, \`public_id\` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, \`link_id\` varchar(36) NOT NULL, \`s3_key\` varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, \`name\` varchar(255) NOT NULL, \`size\` bigint unsigned NOT NULL, \`mime\` varchar(255) NULL, \`sha256\` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, \`status\` varchar(16) NOT NULL, \`upload_id\` varchar(1024) CHARACTER SET ascii COLLATE ascii_bin NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`completed_at\` datetime(6) NULL, \`deleted_at\` datetime(6) NULL, UNIQUE INDEX \`UQ_files_public_id\` (\`public_id\`), UNIQUE INDEX \`UQ_files_s3_key\` (\`s3_key\`), INDEX \`IDX_files_link_id\` (\`link_id\`), INDEX \`IDX_files_status_created_at\` (\`status\`, \`created_at\`), CONSTRAINT \`CHK_files_status\` CHECK (\`status\` IN ('uploading', 'verifying', 'ready', 'rejected')), CONSTRAINT \`CHK_files_sha256\` CHECK (\`sha256\` REGEXP '^[0-9a-f]{64}$'), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_files_link\` FOREIGN KEY (\`link_id\`) REFERENCES \`links\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`files\``);
    await queryRunner.query(
      `ALTER TABLE \`links\` DROP CHECK \`CHK_links_max_downloads\`, DROP COLUMN \`download_count\`, DROP COLUMN \`max_downloads\``,
    );
  }
}
