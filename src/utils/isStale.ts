/** Check if a metric timestamp is older than maxAgeHours (or missing). */
export function isStale(
  timestamp: string | null,
  maxAgeHours: number,
): boolean {
  if (!timestamp) return true;
  const age = Date.now() - new Date(timestamp).getTime();
  return age > maxAgeHours * 60 * 60 * 1000;
}
