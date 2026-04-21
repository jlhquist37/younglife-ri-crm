// Returns true if contact is stale (60+ days no activity)
export function isStale(lastTouchpointDate: string | null, createdAt: string): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  if (lastTouchpointDate) return new Date(lastTouchpointDate) < cutoff
  return new Date(createdAt) < cutoff
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
