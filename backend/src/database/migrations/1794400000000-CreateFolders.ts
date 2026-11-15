import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFolders1794400000000 implements MigrationInterface {
  name = 'CreateFolders1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`folders\` (\`id\` varchar(36) NOT NULL, \`public_id\` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, \`name\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, \`name_key\` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_folders_public_id\` (\`public_id\`), UNIQUE INDEX \`UQ_folders_name_key\` (\`name_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`links\` ADD \`folder_id\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`links\` ADD INDEX \`IDX_links_folder_id\` (\`folder_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`links\` ADD CONSTRAINT \`FK_links_folder\` FOREIGN KEY (\`folder_id\`) REFERENCES \`folders\` (\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`links\` DROP FOREIGN KEY \`FK_links_folder\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_links_folder_id\` ON \`links\``);
    await queryRunner.query(`ALTER TABLE \`links\` DROP COLUMN \`folder_id\``);
    await queryRunner.query(`DROP TABLE \`folders\``);
  }
}
