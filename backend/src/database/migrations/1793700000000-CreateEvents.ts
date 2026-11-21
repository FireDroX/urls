import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvents1793700000000 implements MigrationInterface {
  name = 'CreateEvents1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`events\` (\`id\` varchar(36) NOT NULL, \`link_id\` varchar(36) NOT NULL, \`type\` varchar(16) NOT NULL, \`referer\` varchar(2048) NULL, \`user_agent\` varchar(512) NULL, \`country\` char(2) NULL, \`ip_hash\` char(64) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_events_link_id_created_at\` (\`link_id\`, \`created_at\`), CONSTRAINT \`CHK_events_type\` CHECK (\`type\` IN ('click')), PRIMARY KEY (\`id\`), CONSTRAINT \`FK_events_link\` FOREIGN KEY (\`link_id\`) REFERENCES \`links\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`events\``);
  }
}
