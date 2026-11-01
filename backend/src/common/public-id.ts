import { customAlphabet } from 'nanoid';
import { PUBLIC_ID_ALPHABET, PUBLIC_ID_LENGTH } from './variables.global.js';

export const generatePublicId = customAlphabet(
  PUBLIC_ID_ALPHABET,
  PUBLIC_ID_LENGTH,
);
