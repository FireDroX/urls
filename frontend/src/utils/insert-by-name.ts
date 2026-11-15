export function insertByName<T extends { name: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.name.localeCompare(item.name, undefined, { sensitivity: 'base' }) > 0)
  if (index === -1) return [...items, item]
  return [...items.slice(0, index), item, ...items.slice(index)]
}
