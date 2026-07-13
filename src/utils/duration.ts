/** Bleed/Greed-style duration parsing: 1h, 2d3h, 30m, 1 week */
export function parseDurationMs(input: string): number | null {
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  // Combined units: 1w2d3h4m5s
  const combo = cleaned.matchAll(/(\d+)\s*(w|d|h|m|s|weeks?|days?|hours?|hrs?|minutes?|mins?|seconds?|secs?)/g);
  let total = 0;
  let matched = false;
  for (const match of combo) {
    matched = true;
    const n = Number(match[1]);
    const unit = match[2];
    if (unit.startsWith('w')) total += n * 7 * 86_400_000;
    else if (unit.startsWith('d')) total += n * 86_400_000;
    else if (unit.startsWith('h')) total += n * 3_600_000;
    else if (unit.startsWith('m')) total += n * 60_000;
    else total += n * 1_000;
  }
  if (matched && total > 0) return total;

  // Plain number = minutes (common mod bot convention)
  if (/^\d+$/.test(cleaned)) return Number(cleaned) * 60_000;

  return null;
}

export function formatDuration(ms: number): string {
  const parts: string[] = [];
  const weeks = Math.floor(ms / (7 * 86_400_000));
  ms %= 7 * 86_400_000;
  const days = Math.floor(ms / 86_400_000);
  ms %= 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms %= 3_600_000;
  const minutes = Math.floor(ms / 60_000);
  ms %= 60_000;
  const seconds = Math.floor(ms / 1_000);
  if (weeks) parts.push(`${weeks}w`);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || !parts.length) parts.push(`${seconds}s`);
  return parts.join('');
}
