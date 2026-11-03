import type { IncomingMessage } from 'node:http';
import {
  FILE_PART_UPLOAD_PATH_REGEX,
  JSON_CONTENT_TYPE_REGEX,
} from './variables.global.js';

export function parsesAsJson(request: IncomingMessage): boolean {
  return (
    !FILE_PART_UPLOAD_PATH_REGEX.test(request.url ?? '') &&
    JSON_CONTENT_TYPE_REGEX.test(request.headers['content-type'] ?? '')
  );
}
