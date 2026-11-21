import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLinkChecks1794300000000 implements MigrationInterface {
  name = 'CreateLinkChecks1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`link_checks\` (\`link_id\` varchar(36) NOT NULL, \`outcome\` varchar(16) NOT NULL, \`status_code\` smallint unsigned NULL, \`error_kind\` varchar(32) NULL, \`consecutive_failures\` int unsigned NOT NULL DEFAULT 0, \`checked_at\` datetime(6) NOT NULL, CONSTRAINT \`CHK_link_checks_outcome\` CHECK (\`outcome\` IN ('ok', 'broken', 'skipped')), CONSTRAINT \`CHK_link_checks_error_kind\` CHECK (\`error_kind\` IS NULL OR \`error_kind\` IN ('dns', 'connection', 'tls', 'timeout', 'too_many_redirects', 'invalid_redirect')), CONSTRAINT \`CHK_link_checks_status_code\` CHECK (\`status_code\` IS NULL OR \`status_code\` BETWEEN 100 AND 599), PRIMARY KEY (\`link_id\`), CONSTRAINT \`FK_link_checks_link\` FOREIGN KEY (\`link_id\`) REFERENCES \`links\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`link_checks\``);
  }
}
