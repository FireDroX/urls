import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTags1794250000000 implements MigrationInterface {
  name = 'CreateTags1794250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`tags\` (\`id\` varchar(36) NOT NULL, \`public_id\` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, \`name\` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL, \`color\` varchar(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_tags_public_id\` (\`public_id\`), UNIQUE INDEX \`UQ_tags_name\` (\`name\`), CONSTRAINT \`CHK_tags_color\` CHECK (\`color\` REGEXP '^#[0-9a-f]{6}$'), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`link_tags\` (\`link_id\` varchar(36) NOT NULL, \`tag_id\` varchar(36) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_link_tags_tag_id\` (\`tag_id\`), PRIMARY KEY (\`link_id\`, \`tag_id\`), CONSTRAINT \`FK_link_tags_link\` FOREIGN KEY (\`link_id\`) REFERENCES \`links\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT \`FK_link_tags_tag\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`link_tags\``);
    await queryRunner.query(`DROP TABLE \`tags\``);
  }
}
