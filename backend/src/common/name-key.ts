export function toNameKey(name: string): string {
  return name.normalize('NFC').toLowerCase().normalize('NFC');
}
