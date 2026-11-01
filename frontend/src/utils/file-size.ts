const STEP = 1024

export function formatFileSize(bytes: number, units: readonly string[], locale: string): string {
  let value = bytes
  let unit = 0
  while (value >= STEP && unit < units.length - 1) {
    value /= STEP
    unit += 1
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[unit]}`
}
