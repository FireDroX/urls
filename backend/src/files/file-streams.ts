import { createHash } from 'node:crypto';
import { type Readable, Transform } from 'node:stream';
import { PartLengthMismatchException } from '../common/exceptions/files/part-length-mismatch.exception.js';
import { PartTooLargeException } from '../common/exceptions/files/part-too-large.exception.js';
import { FILE_HASH_ALGORITHM } from '../common/variables.global.js';

export interface ObjectDigest {
  sha256: string;
  head: Buffer;
}

export function measuredPart(source: Readable, expectedSize: number): Readable {
  let received = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > expectedSize) {
        callback(new PartTooLargeException());
        return;
      }
      callback(null, chunk);
    },
    flush(callback) {
      callback(
        received === expectedSize ? null : new PartLengthMismatchException(),
      );
    },
  });
  const interrupt = () => {
    if (!source.readableEnded) {
      counter.destroy(new PartLengthMismatchException());
    }
  };
  source.once('error', interrupt);
  source.once('close', interrupt);
  counter.once('error', () => {
    source.unpipe(counter);
    source.resume();
  });
  source.pipe(counter);
  return counter;
}

export async function digestObject(
  stream: Readable,
  headBytes: number,
): Promise<ObjectDigest> {
  const hash = createHash(FILE_HASH_ALGORITHM);
  const head: Buffer[] = [];
  let kept = 0;
  for await (const chunk of stream) {
    const bytes = chunk as Buffer;
    hash.update(bytes);
    if (kept < headBytes) {
      const slice = bytes.subarray(0, headBytes - kept);
      head.push(slice);
      kept += slice.length;
    }
  }
  return { sha256: hash.digest('hex'), head: Buffer.concat(head) };
}
