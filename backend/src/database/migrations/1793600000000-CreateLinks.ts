import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLinks1793600000000 implements MigrationInterface {
  name = 'CreateLinks1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`links\` (\`id\` varchar(36) NOT NULL, \`public_id\` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, \`type\` varchar(16) NOT NULL, \`destination\` varchar(2048) NULL, \`expires_at\` datetime(6) NULL, \`disabled\` tinyint(1) NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, UNIQUE INDEX \`UQ_links_public_id\` (\`public_id\`), INDEX \`IDX_links_type_created_at\` (\`type\`, \`created_at\`), CONSTRAINT \`CHK_links_type\` CHECK (\`type\` IN ('redirect', 'share', 'drop')), CONSTRAINT \`CHK_links_redirect_destination\` CHECK (\`type\` <> 'redirect' OR \`destination\` IS NOT NULL), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`links\``);
  }
}
