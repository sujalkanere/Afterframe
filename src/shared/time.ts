export function formatTimestampMs(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || Number.isNaN(ms) || ms < 0) {
    return null;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
