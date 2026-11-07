import type { ValueTransformer } from 'typeorm';

export const bigintToNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null) =>
    value === null ? null : Number(value),
};
