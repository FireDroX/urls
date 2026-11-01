import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemSettings1793557000000 implements MigrationInterface {
  name = 'CreateSystemSettings1793557000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`system_settings\` (\`key\` varchar(64) NOT NULL, \`value\` varchar(255) NOT NULL, PRIMARY KEY (\`key\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `INSERT INTO \`system_settings\` (\`key\`, \`value\`) VALUES ('locale', 'fr')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`system_settings\``);
  }
}
