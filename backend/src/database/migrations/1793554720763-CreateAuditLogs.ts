import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1793554720763 implements MigrationInterface {
  name = 'CreateAuditLogs1793554720763';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`audit_logs\` (\`id\` varchar(36) NOT NULL, \`action\` varchar(64) NOT NULL, \`user_id\` varchar(36) NULL, \`target_id\` varchar(64) NULL, \`ip\` varchar(45) NULL, \`user_agent\` varchar(500) NULL, \`metadata\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_audit_logs_created_at\` (\`created_at\`), INDEX \`IDX_audit_logs_action\` (\`action\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_logs\` ADD CONSTRAINT \`FK_audit_logs_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`audit_logs\` DROP FOREIGN KEY \`FK_audit_logs_user\``,
    );
    await queryRunner.query(`DROP TABLE \`audit_logs\``);
  }
}
