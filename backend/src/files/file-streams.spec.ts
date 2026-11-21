import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PartLengthMismatchException } from '../common/exceptions/files/part-length-mismatch.exception.js';
import { PartTooLargeException } from '../common/exceptions/files/part-too-large.exception.js';
import { digestObject, measuredPart } from './file-streams.js';

async function drain(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function source(...chunks: string[]): Readable {
  return Readable.from(chunks.map((chunk) => Buffer.from(chunk)));
}

describe('measuredPart', () => {
  it('passes a body of exactly the expected size through', async () => {
    await expect(drain(measuredPart(source('abc', 'de'), 5))).resolves.toEqual(
      Buffer.from('abcde'),
    );
  });

  it('cuts the stream with a 413 as soon as it goes over the expected size', async () => {
    await expect(
      drain(measuredPart(source('abc', 'def'), 5)),
    ).rejects.toBeInstanceOf(PartTooLargeException);
  });

  it('fails a body shorter than announced', async () => {
    await expect(drain(measuredPart(source('abc'), 5))).rejects.toBeInstanceOf(
      PartLengthMismatchException,
    );
  });

  it('fails when the client goes away mid-part', async () => {
    const body = new Readable({ read() {} });
    const drained = drain(measuredPart(body, 5));
    body.push(Buffer.from('ab'));
    body.destroy();

    await expect(drained).rejects.toBeInstanceOf(PartLengthMismatchException);
  });
});

describe('digestObject', () => {
  it('hashes the whole stream and keeps only its first bytes', async () => {
    const digest = await digestObject(source('hello ', 'world'), 4);

    expect(digest.sha256).toBe(
      createHash('sha256').update('hello world').digest('hex'),
    );
    expect(digest.head).toEqual(Buffer.from('hell'));
  });
});
