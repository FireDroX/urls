import { customAlphabet } from 'nanoid';
import {
  LINK_SLUG_MAX_LENGTH,
  LINK_SLUG_REGEX,
  PUBLIC_ID_ALPHABET,
  PUBLIC_ID_LENGTH,
} from './variables.global.js';

export const generatePublicId = customAlphabet(
  PUBLIC_ID_ALPHABET,
  PUBLIC_ID_LENGTH,
);

export function isWellFormedLinkId(publicId: string): boolean {
  return (
    publicId.length <= LINK_SLUG_MAX_LENGTH && LINK_SLUG_REGEX.test(publicId)
  );
}
