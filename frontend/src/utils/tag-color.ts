const HEX_COLOR_REGEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const BLACK = '#000000'
const WHITE = '#ffffff'
const WHITE_LUMINANCE = 1

function linearize(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(red: number, green: number, blue: number): number {
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
}

export function readableTextColor(color: string): string {
  const match = HEX_COLOR_REGEX.exec(color)
  if (!match) return WHITE
  const [red, green, blue] = [match[1], match[2], match[3]].map((part) => parseInt(part, 16))
  const background = luminance(red, green, blue)
  const contrastWithWhite = (WHITE_LUMINANCE + 0.05) / (background + 0.05)
  const contrastWithBlack = (background + 0.05) / 0.05
  return contrastWithBlack > contrastWithWhite ? BLACK : WHITE
}
