import { MigrationInterface, QueryRunner } from 'typeorm';

const HOST_MAX_LENGTH = 255;
const WEB_PROTOCOLS = ['http:', 'https:'];
const UPDATE_BATCH_SIZE = 500;

interface RefererRow {
  id: string;
  referer: string;
}

function hostOf(referer: string): string | null {
  if (!URL.canParse(referer)) {
    return null;
  }
  const { protocol, hostname } = new URL(referer);
  if (!WEB_PROTOCOLS.includes(protocol) || !hostname) {
    return null;
  }
  return hostname.slice(0, HOST_MAX_LENGTH);
}

function groupIdsByHost(rows: RefererRow[]): Map<string, string[]> {
  const idsByHost = new Map<string, string[]>();
  for (const { id, referer } of rows) {
    const host = hostOf(referer);
    if (host) {
      idsByHost.set(host, [...(idsByHost.get(host) ?? []), id]);
    }
  }
  return idsByHost;
}

export class AddEventsRefererHost1793800000000 implements MigrationInterface {
  name = 'AddEventsRefererHost1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD \`referer_host\` varchar(255) NULL AFTER \`referer\``,
    );
    const rows = (await queryRunner.query(
      `SELECT \`id\`, \`referer\` FROM \`events\` WHERE \`referer\` IS NOT NULL`,
    )) as RefererRow[];
    for (const [host, ids] of groupIdsByHost(rows)) {
      for (let start = 0; start < ids.length; start += UPDATE_BATCH_SIZE) {
        await queryRunner.query(
          `UPDATE \`events\` SET \`referer_host\` = ? WHERE \`id\` IN (?)`,
          [host, ids.slice(start, start + UPDATE_BATCH_SIZE)],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP COLUMN \`referer_host\``,
    );
  }
}
