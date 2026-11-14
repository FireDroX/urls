export function tagNameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}
