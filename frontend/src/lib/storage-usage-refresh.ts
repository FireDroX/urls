const listeners = new Set<() => void>()

export function subscribeStorageUsageRefresh(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function refreshStorageUsage(): void {
  listeners.forEach((listener) => listener())
}
