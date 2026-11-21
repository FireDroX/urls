const listeners = new Set<() => void>()

export function subscribeLinkHealthRefresh(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function refreshLinkHealth(): void {
  listeners.forEach((listener) => listener())
}
